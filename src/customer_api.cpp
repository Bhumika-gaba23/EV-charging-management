#include "customer_api.hpp"
#include <sqlite3.h>
#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cmath>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <memory>
#include <iomanip>
#include <limits>
#include <mutex>
#include <random>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace pluggo {
namespace {
using Json = crow::json::wvalue;
using Input = crow::json::rvalue;
using Row = std::vector<std::string>;
std::int64_t nowMs() { return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count(); }
std::string env(const char* key, std::string fallback) { const auto value=std::getenv(key);return value?value:std::move(fallback); }
std::string randomId() { std::random_device rd; const char* digits="0123456789abcdef";std::string value;for(int i=0;i<32;++i)value+=digits[rd()&15];return value; }
struct ApiError : std::runtime_error { int status;ApiError(int code,const std::string& message):runtime_error(message),status(code){} };
std::string string(const Input& value,const char* key,std::string fallback="") { if(!value.has(key))return fallback;if(value[key].t()!=crow::json::type::String)throw ApiError(400,std::string(key)+" must be text");return std::string(value[key].s()); }
double number(const Input& value,const char* key,double fallback) {if(!value.has(key))return fallback;if(value[key].t()!=crow::json::type::Number)throw ApiError(400,std::string(key)+" must be numeric");const double n=value[key].d();if(!std::isfinite(n))throw ApiError(400,"Numbers must be finite");return n;}
struct Session {
 std::string id,owner,station,connector,vehicle,key,request,reason;
 std::int64_t started=0,ended=0;double target=80,budget=300,power=0,energy=0,capacity=40,rate=18,limit=0;bool settled=false;
 Json json() const {Json j;j["id"]=id;j["station"]=station;j["connector"]=connector;j["vehicle"]=vehicle;j["started"]=started;j["ended"]=ended?Json(ended):Json(nullptr);j["target"]=target;j["budget"]=budget;j["power"]=power;j["energy"]=energy;j["capacity"]=capacity;j["rate"]=rate;j["cost"]=energy*rate;j["limit"]=limit;j["currentSoc"]=25+100*energy/capacity;j["settled"]=settled;j["reason"]=reason;j["backendOwned"]=true;if(settled){j["receipt"]["id"]="INV-"+id;j["receipt"]["amountCollected"]=0;j["receipt"]["currency"]="INR";}return j;}
};
class Store {
 sqlite3* db=nullptr;Input catalog;
 std::vector<Row> query(const std::string& sql,const Row& args={}) {
  sqlite3_stmt* raw=nullptr;if(sqlite3_prepare_v2(db,sql.c_str(),-1,&raw,nullptr)!=SQLITE_OK)throw std::runtime_error(sqlite3_errmsg(db));
  std::unique_ptr<sqlite3_stmt,decltype(&sqlite3_finalize)> stmt(raw,sqlite3_finalize);
  for(std::size_t i=0;i<args.size();++i)sqlite3_bind_text(raw,static_cast<int>(i+1),args[i].c_str(),-1,SQLITE_TRANSIENT);
  std::vector<Row> rows;int rc;
  while((rc=sqlite3_step(raw))==SQLITE_ROW){Row row;for(int i=0;i<sqlite3_column_count(raw);++i){const auto text=sqlite3_column_text(raw,i);row.emplace_back(text?reinterpret_cast<const char*>(text):"");}rows.push_back(std::move(row));}
  if(rc!=SQLITE_DONE)throw std::runtime_error(sqlite3_errmsg(db));return rows;
 }
 Session fromRow(const Row& row) {const auto j=crow::json::load(row[3]);Session s;s.id=row[0];s.owner=row[1];s.key=row[2];s.request=row[4];s.station=string(j,"station");s.connector=string(j,"connector");s.vehicle=string(j,"vehicle");s.started=static_cast<std::int64_t>(j["started"].d());s.ended=j["ended"].t()==crow::json::type::Null?0:static_cast<std::int64_t>(j["ended"].d());s.target=j["target"].d();s.budget=j["budget"].d();s.power=j["power"].d();s.energy=j["energy"].d();s.capacity=j["capacity"].d();s.rate=j["rate"].d();s.limit=j["limit"].d();s.settled=j["settled"].b();s.reason=string(j,"reason");return s;}
 std::vector<Session> sessions(const std::string& owner="") {std::vector<Session> values;auto rows=query("SELECT id,owner,idem,payload,request FROM customer_sessions"+(owner.empty()?std::string():" WHERE owner=?")+" ORDER BY started DESC",owner.empty()?Row{}:Row{owner});for(const auto& row:rows)values.push_back(fromRow(row));return values;}
 void persist(const Session& s) {query("INSERT INTO customer_sessions(id,owner,idem,request,connector,started,ended,settled,payload) VALUES(?,?,?,?,?,?,NULLIF(?,''),?,?) ON CONFLICT(id) DO UPDATE SET ended=excluded.ended,settled=excluded.settled,payload=excluded.payload",{s.id,s.owner,s.key,s.request,s.connector,std::to_string(s.started),s.ended?std::to_string(s.ended):"",s.settled?"1":"0",s.json().dump()});}
 void advance() {if(mode!="clock")return;for(auto s:sessions()){if(s.ended)continue;const double elapsed=std::max<std::int64_t>(0,nowMs()-s.started)/1000.;s.energy=std::min(s.limit,elapsed*s.power*speed/3600.);complete(s);persist(s);}}
 void complete(Session& s) {if(s.energy+1e-9<s.limit)return;s.energy=s.limit;if(!s.ended)s.ended=mode=="clock"?s.started+static_cast<std::int64_t>(s.limit/s.power*3600000./speed):nowMs();s.reason=s.budget/s.rate<=((s.target-25)/100*s.capacity)?"Budget limit reached":"Charge target reached";}
 const Input& profile(const std::string& id) {if(!catalog["vehicles"].has(id))throw ApiError(400,"Unknown vehicle profile");return catalog["vehicles"][id];}
 bool busy(const std::string& id) {return !query("SELECT id FROM customer_sessions WHERE connector=? AND ended IS NULL",{id}).empty();}
 struct Connector {std::string station,id,type;double power,rate;bool enabled;};
 Connector connector(const std::string& id) {for(const auto& station:catalog["stations"])for(const auto& c:station["connectors"])if(std::string(c["id"].s())==id)return {std::string(station["id"].s()),id,std::string(c["type"].s()),c["power"].d(),station["rate"].d(),c["available"].b()};throw ApiError(404,"Charger code not found");}
 bool compatible(const Input& vehicle,const std::string& type) {for(const auto& c:vehicle["connectors"])if(std::string(c.s())==type)return true;return false;}
 bool simulatorOnline() const {return nowMs()-lastSimulator<15000;}
public:
 std::mutex mutex;std::string mode,key;double speed;std::int64_t lastSimulator=0;
 Store():mode(env("CHARGEFLOW_SIMULATION_MODE","clock")),key(env("CHARGEFLOW_SIMULATOR_KEY","local-simulator-key")),speed(std::stod(env("CHARGEFLOW_SIMULATION_SPEED","60"))) {
  if((mode!="clock"&&mode!="meter")||!std::isfinite(speed)||speed<=0||speed>600)throw std::runtime_error("Invalid simulation configuration");
  std::ifstream input(env("CHARGEFLOW_CATALOG_FILE",EV_CATALOG_FILE));std::ostringstream content;content<<input.rdbuf();catalog=crow::json::load(content.str());if(!catalog||!catalog.has("stations")||!catalog.has("vehicles"))throw std::runtime_error("Cannot load customer catalog");
  const auto path=env("CHARGEFLOW_CUSTOMER_DB","data/pluggo.sqlite3");if(path!=":memory:"){auto parent=std::filesystem::path(path).parent_path();if(!parent.empty())std::filesystem::create_directories(parent);}
  if(sqlite3_open(path.c_str(),&db)!=SQLITE_OK)throw std::runtime_error("Cannot open customer database");sqlite3_busy_timeout(db,5000);query("PRAGMA journal_mode=WAL");query("PRAGMA foreign_keys=ON");
  query("CREATE TABLE IF NOT EXISTS customer_visitors(id TEXT PRIMARY KEY,vehicle TEXT NOT NULL DEFAULT 'car',saved TEXT NOT NULL DEFAULT '[]')");
  query("CREATE TABLE IF NOT EXISTS customer_sessions(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES customer_visitors(id),idem TEXT NOT NULL,request TEXT NOT NULL,connector TEXT NOT NULL,started INTEGER NOT NULL,ended INTEGER,settled INTEGER NOT NULL DEFAULT 0,payload TEXT NOT NULL,UNIQUE(owner,idem))");
  query("CREATE UNIQUE INDEX IF NOT EXISTS customer_active_connector ON customer_sessions(connector) WHERE ended IS NULL");
  query("CREATE UNIQUE INDEX IF NOT EXISTS customer_unfinished_owner ON customer_sessions(owner) WHERE settled=0");
 }
 ~Store(){if(db)sqlite3_close(db);}
 Json health(){query("SELECT COUNT(*) FROM customer_visitors");Json j;j["ok"]=true;j["database"]="sqlite";j["identityProvider"]="local-visitor-cookie";j["productionOidc"]=false;j["simulationMode"]=mode;j["simulatorConnected"]=simulatorOnline();return j;}
 void begin(){query("BEGIN IMMEDIATE");}void commit(){query("COMMIT");}void rollback(){try{query("ROLLBACK");}catch(...){}}
 std::string visitor(const crow::request& request,bool create,bool& fresh) {const auto cookie=request.get_header_value("Cookie");std::string id;std::istringstream stream(cookie);std::string part;while(std::getline(stream,part,';')){const auto first=part.find_first_not_of(' ');if(first!=std::string::npos&&part.compare(first,13,"pluggo_guest=")==0)id=part.substr(first+13);}
  if(id.size()==32&&id.find_first_not_of("0123456789abcdef")==std::string::npos&&!query("SELECT id FROM customer_visitors WHERE id=?",{id}).empty())return id;
  if(!create)throw ApiError(401,"Open the app again to establish your visitor session");id=randomId();query("INSERT INTO customer_visitors(id) VALUES(?)",{id});fresh=true;return id;
 }
 Json snapshot(const std::string& owner) {advance();Json result;result["ok"]=true;const auto prefs=query("SELECT vehicle,saved FROM customer_visitors WHERE id=?",{owner});if(prefs.empty())throw ApiError(401,"Visitor not found");result["state"]["vehicle"]=prefs[0][0];result["state"]["saved"]=Json(crow::json::load(prefs[0][1]));Json::list list;for(const auto& s:sessions(owner))list.push_back(s.json());result["state"]["sessions"]=std::move(list);result["catalog"]=Json(catalog);
  int index=0;for(const auto& station:catalog["stations"]){int ci=0;for(const auto& c:station["connectors"]){auto con=connector(std::string(c["id"].s()));result["catalog"]["stations"][index]["connectors"][ci]["available"]=con.enabled&&!busy(con.id)&&(mode=="clock"||simulatorOnline());++ci;}++index;}
  result["backend"]["storage"]="sqlite";result["backend"]["simulationMode"]=mode;result["backend"]["simulationSpeed"]=speed;result["backend"]["simulatorConnected"]=simulatorOnline();result["backend"]["serverTime"]=nowMs();return result;
 }
 Json operatorStation() {
  advance();const auto all=sessions();Json j;j["ok"]=true;j["dataSource"]="customer-sessions";j["simulated"]=true;j["simulatorConnected"]=simulatorOnline();j["serverTime"]=nowMs();
  double power=0,energy=0,cost=0;Json::list slots,recent;
  for(const auto& s:all){energy+=s.energy;cost+=s.energy*s.rate;if(!s.ended)power+=s.power;if(recent.size()<10){auto item=s.json();item["vehicleName"]=string(profile(s.vehicle),"name",s.vehicle);recent.push_back(std::move(item));}}
  for(const auto& station:catalog["stations"])for(const auto& c:station["connectors"]){
   const std::string id=c["id"].s();const Session* active=nullptr;for(const auto& s:all)if(s.connector==id&&!s.ended){active=&s;break;}
   Json slot;slot["id"]=id;slot["stationName"]=string(station,"name",std::string(station["id"].s()));slot["connector"]=std::string(c["type"].s());slot["source"]="SIMULATOR";
   slot["status"]=active?"occupied":!c["available"].b()?"disabled":mode=="meter"&&!simulatorOnline()?"offline":"available";
   slot["vehicle"]=active?string(profile(active->vehicle),"name",active->vehicle):"";slot["soc"]=active?25+100*active->energy/active->capacity:0;slot["powerKW"]=active?active->power:0;slot["energyKWh"]=active?active->energy:0;slot["estimatedCost"]=active?active->energy*active->rate:0;slots.push_back(std::move(slot));
  }
  j["slots"]=std::move(slots);j["recentSessions"]=std::move(recent);j["activePowerKW"]=power;j["energyKWh"]=energy;j["estimatedCost"]=cost;j["solarShare"]=0;return j;
 }
 void preferences(const std::string& owner,const Input& body) {const auto vehicle=string(body,"vehicle");profile(vehicle);if(!body.has("saved")||body["saved"].t()!=crow::json::type::List||body["saved"].size()>20)throw ApiError(400,"Invalid saved stations");Json::list saved;for(const auto& item:body["saved"]){if(item.t()!=crow::json::type::String)throw ApiError(400,"Invalid station ID");const std::string id=item.s();bool found=false;for(const auto& s:catalog["stations"])if(std::string(s["id"].s())==id)found=true;if(!found)throw ApiError(400,"Unknown saved station");saved.emplace_back(id);}query("UPDATE customer_visitors SET vehicle=?,saved=? WHERE id=?",{vehicle,Json(std::move(saved)).dump(),owner});}
 Json verify(const Input& body) {advance();const auto con=connector(string(body,"connector"));const auto& v=profile(string(body,"vehicle"));if(con.station!=string(body,"station"))throw ApiError(400,"Charger does not belong to this station");if(!compatible(v,con.type))throw ApiError(409,"Connector is incompatible with this vehicle");if(!con.enabled||busy(con.id))throw ApiError(409,"Connector is in use");if(mode=="meter"&&!simulatorOnline())throw ApiError(409,"Charging simulator is offline");Json j;j["ok"]=true;j["connector"]=con.id;return j;}
 std::string start(const std::string& owner,const Input& body,const std::string& idem) {advance();if(idem.empty()||idem.size()>128)throw ApiError(400,"A valid Idempotency-Key is required");const auto vehicle=string(body,"vehicle"),charger=string(body,"connector");const double target=number(body,"target",80),budget=number(body,"budget",300);if(target<30||target>100||budget<50||budget>1000)throw ApiError(400,"Target must be 30–100 and budget 50–1000");const auto& v=profile(vehicle);const auto c=connector(charger);const auto station=string(body,"station");if(c.station!=station)throw ApiError(400,"Charger does not belong to this station");std::ostringstream normalized;normalized<<std::setprecision(std::numeric_limits<double>::max_digits10)<<vehicle<<'|'<<charger<<'|'<<target<<'|'<<budget;auto previous=query("SELECT id,request FROM customer_sessions WHERE owner=? AND idem=?",{owner,idem});if(!previous.empty()){if(previous[0][1]!=normalized.str())throw ApiError(409,"Idempotency key was used for another request");return previous[0][0];}
  if(!compatible(v,c.type))throw ApiError(409,"Vehicle and connector are incompatible");if(!c.enabled||busy(c.id))throw ApiError(409,"Charger is no longer available");if(mode=="meter"&&!simulatorOnline())throw ApiError(409,"Charging simulator is offline");if(!query("SELECT id FROM customer_sessions WHERE owner=? AND settled=0",{owner}).empty())throw ApiError(409,"Finish your existing session or checkout first");
  Session s;s.id="PG-"+randomId();s.owner=owner;s.station=station;s.connector=charger;s.vehicle=vehicle;s.key=idem;s.request=normalized.str();s.started=nowMs();s.target=target;s.budget=budget;s.capacity=v["capacity"].d();s.power=std::min(v["power"].d(),c.power);s.rate=c.rate;s.limit=std::min((target-25)/100*s.capacity,budget/c.rate);persist(s);return s.id;
 }
 void action(const std::string& owner,const std::string& id,bool checkout) {advance();auto rows=query("SELECT id,owner,idem,payload,request FROM customer_sessions WHERE id=? AND owner=?",{id,owner});if(rows.empty())throw ApiError(404,"Session not found");auto s=fromRow(rows[0]);if(checkout){if(!s.ended)throw ApiError(409,"Stop charging before checkout");s.settled=true;}else if(!s.ended){s.ended=nowMs();s.reason="Stopped by you";}persist(s);}
 void reset(const std::string& owner) {query("DELETE FROM customer_sessions WHERE owner=?",{owner});query("UPDATE customer_visitors SET vehicle='car',saved='[]' WHERE id=?",{owner});}
 Json simulatorSessions() {lastSimulator=nowMs();advance();Json j;j["ok"]=true;j["mode"]=mode;j["speed"]=speed;Json::list values;for(const auto& s:sessions())if(!s.ended)values.push_back(s.json());j["sessions"]=std::move(values);return j;}
 void meter(const Input& body) {lastSimulator=nowMs();if(mode!="meter")return;const auto id=string(body,"sessionId");auto rows=query("SELECT id,owner,idem,payload,request FROM customer_sessions WHERE id=?",{id});if(rows.empty())throw ApiError(404,"Session not found");auto s=fromRow(rows[0]);if(s.ended)return;if(string(body,"connector")!=s.connector)throw ApiError(409,"Meter connector does not match session");const double energy=number(body,"energyKWh",s.energy);if(energy<0)throw ApiError(400,"Energy must be non-negative");s.energy=std::min(s.limit,std::max(s.energy,energy));complete(s);persist(s);}
};
std::shared_ptr<Store> store;
crow::response response(Json j,int status=200){crow::response r(status,j.dump());r.set_header("Content-Type","application/json; charset=utf-8");r.set_header("Cache-Control","no-store");return r;}
Input body(const crow::request& request){if(request.body.size()>16384)throw ApiError(413,"Request is too large");auto value=crow::json::load(request.body);if(!value||value.t()!=crow::json::type::Object)throw ApiError(400,"Invalid JSON object");return value;}
crow::response customer(const crow::request& request,bool bootstrap,const std::function<Json(const std::string&)>& operation){std::lock_guard<std::mutex> lock(store->mutex);bool transaction=false;try{const auto origin=request.get_header_value("Origin"),host=request.get_header_value("Host");if(!origin.empty()&&origin!="http://"+host&&origin!="https://"+host)throw ApiError(403,"Cross-origin request rejected");if(request.method!=crow::HTTPMethod::GET&&request.get_header_value("X-Pluggo-Request")!="1")throw ApiError(403,"Missing application request header");store->begin();transaction=true;bool fresh=false;auto owner=store->visitor(request,bootstrap,fresh);auto value=operation(owner);store->commit();transaction=false;auto r=response(std::move(value));if(fresh)r.set_header("Set-Cookie","pluggo_guest="+owner+"; HttpOnly; SameSite=Strict; Path=/api/customer; Max-Age=31536000"+(env("CHARGEFLOW_COOKIE_SECURE","0")=="1"?"; Secure":""));return r;}catch(const ApiError& e){if(transaction)store->rollback();Json j;j["ok"]=false;j["error"]=e.what();return response(std::move(j),e.status);}catch(const std::exception& e){if(transaction)store->rollback();std::cerr<<"customer API: "<<e.what()<<'\n';Json j;j["ok"]=false;j["error"]="Backend storage operation failed";return response(std::move(j),500);}}
}
crow::response customerOperatorStation(){std::lock_guard<std::mutex> lock(store->mutex);try{return response(store->operatorStation());}catch(const std::exception& e){Json j;j["ok"]=false;j["error"]="Session overview unavailable";return response(std::move(j),503);}}
crow::response customerReadiness(){std::lock_guard<std::mutex> lock(store->mutex);try{return response(store->health());}catch(...){Json j;j["ok"]=false;j["error"]="Customer storage is unavailable";return response(std::move(j),503);}}
void registerCustomerApi(crow::SimpleApp& app){store=std::make_shared<Store>();
 CROW_WEBSOCKET_ROUTE(app,"/ocpp/customer")
  .onaccept([](const crow::request& request,void**){return request.get_header_value("X-Charger-Key")==store->key;})
  .onopen([](crow::websocket::connection&){std::lock_guard<std::mutex> lock(store->mutex);store->lastSimulator=nowMs();})
  .onmessage([](crow::websocket::connection& connection,const std::string& message,bool binary){
   if(binary||message.size()>16384)return;
   try {auto packet=crow::json::load(message);if(!packet||packet.t()!=crow::json::type::List||packet.size()!=4||packet[0].i()!=2)return;const std::string id=packet[1].s(),action=packet[2].s();const auto& payload=packet[3];std::lock_guard<std::mutex> lock(store->mutex);store->lastSimulator=nowMs();Json reply;
    if(action=="TransactionEvent"){store->begin();try{store->meter(payload);store->commit();}catch(...){store->rollback();throw;}}
    else if(action=="BootNotification"){reply["status"]="Accepted";reply["interval"]=5;}
    Json::list frame;frame.emplace_back(3);frame.emplace_back(id);frame.push_back(std::move(reply));connection.send_text(Json(std::move(frame)).dump());
   }catch(const std::exception&){connection.close("Invalid customer simulator message");}
  });
 CROW_ROUTE(app,"/api/customer/bootstrap")([](const crow::request& r){return customer(r,true,[](const std::string& owner){return store->snapshot(owner);});});
 CROW_ROUTE(app,"/api/customer/state")([](const crow::request& r){return customer(r,false,[](const std::string& owner){return store->snapshot(owner);});});
 CROW_ROUTE(app,"/api/customer/preferences").methods(crow::HTTPMethod::PUT)([](const crow::request& r){return customer(r,false,[&](const std::string& owner){store->preferences(owner,body(r));return store->snapshot(owner);});});
 CROW_ROUTE(app,"/api/customer/verify").methods(crow::HTTPMethod::POST)([](const crow::request& r){return customer(r,false,[&](const std::string&){return store->verify(body(r));});});
 CROW_ROUTE(app,"/api/customer/sessions").methods(crow::HTTPMethod::POST)([](const crow::request& r){return customer(r,false,[&](const std::string& owner){auto id=store->start(owner,body(r),r.get_header_value("Idempotency-Key"));auto j=store->snapshot(owner);j["sessionId"]=id;return j;});});
 CROW_ROUTE(app,"/api/customer/sessions/<string>/stop").methods(crow::HTTPMethod::POST)([](const crow::request& r,const std::string& id){return customer(r,false,[&](const std::string& owner){store->action(owner,id,false);return store->snapshot(owner);});});
 CROW_ROUTE(app,"/api/customer/sessions/<string>/checkout").methods(crow::HTTPMethod::POST)([](const crow::request& r,const std::string& id){return customer(r,false,[&](const std::string& owner){store->action(owner,id,true);return store->snapshot(owner);});});
 CROW_ROUTE(app,"/api/customer/reset").methods(crow::HTTPMethod::POST)([](const crow::request& r){return customer(r,false,[](const std::string& owner){store->reset(owner);return store->snapshot(owner);});});
 CROW_ROUTE(app,"/api/customer/simulator/active")([](const crow::request& r){if(r.get_header_value("X-Charger-Key")!=store->key){Json j;j["ok"]=false;j["error"]="Invalid simulator key";return response(std::move(j),401);}std::lock_guard<std::mutex> lock(store->mutex);return response(store->simulatorSessions());});
 CROW_ROUTE(app,"/api/customer/simulator/meter").methods(crow::HTTPMethod::POST)([](const crow::request& r){if(r.get_header_value("X-Charger-Key")!=store->key){Json j;j["ok"]=false;j["error"]="Invalid simulator key";return response(std::move(j),401);}std::lock_guard<std::mutex> lock(store->mutex);try{store->begin();store->meter(body(r));store->commit();Json j;j["ok"]=true;return response(std::move(j));}catch(const std::exception& e){store->rollback();Json j;j["ok"]=false;j["error"]=e.what();return response(std::move(j),400);}});
}
}
