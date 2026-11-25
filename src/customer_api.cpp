#include "customer_api.hpp"
#include "ev_system.hpp"
#include "integrations.hpp"
#include <sqlite3.h>
#include <algorithm>
#include <cctype>
#include <chrono>
#include <ctime>
#include <cstdint>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <memory>
#include <set>
#include <map>
#include <iomanip>
#include <limits>
#include <mutex>
#include <optional>
#include <random>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#ifndef EV_PUBLIC_STATIONS_FILE
#define EV_PUBLIC_STATIONS_FILE "database/seed/public_stations.json"
#endif
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
std::unique_ptr<FirebaseVerifier> firebase;
// Real charging stations from OpenStreetMap / Open Charge Map (tools/import-public-stations.py).
// Directory data only: no live availability, booking or payment at these stations.
struct PublicDirectory {
 crow::json::rvalue root;
 struct Entry {double lat,lng;std::string search;std::size_t index;};
 std::vector<Entry> entries;
 void load(){
  std::ifstream input(std::getenv("CHARGEFLOW_PUBLIC_STATIONS_FILE")?std::getenv("CHARGEFLOW_PUBLIC_STATIONS_FILE"):EV_PUBLIC_STATIONS_FILE);
  if(!input){std::cerr<<"public stations: file not found, real-station search is off\n";return;}
  std::ostringstream content;content<<input.rdbuf();root=crow::json::load(content.str());
  if(!root||!root.has("stations")||root["stations"].t()!=crow::json::type::List){std::cerr<<"public stations: invalid file\n";root=crow::json::rvalue();return;}
  for(std::size_t i=0;i<root["stations"].size();++i){const auto& s=root["stations"][i];if(!s.has("lat")||!s.has("lng"))continue;
   std::string text;for(const char* key:{"name","operator","address","city","state"})if(s.has(key)&&s[key].t()==crow::json::type::String){text+=' ';text+=std::string(s[key].s());}
   std::transform(text.begin(),text.end(),text.begin(),[](unsigned char c){return static_cast<char>(std::tolower(c));});
   entries.push_back({s["lat"].d(),s["lng"].d(),std::move(text),i});}
  std::cerr<<"public stations: "<<entries.size()<<" loaded\n";
 }
};
PublicDirectory publicDirectory;
double distanceKm(double lat1,double lng1,double lat2,double lng2){constexpr double r=6371,rad=3.14159265358979323846/180;const double dlat=(lat2-lat1)*rad,dlng=(lng2-lng1)*rad;const double h=std::sin(dlat/2)*std::sin(dlat/2)+std::cos(lat1*rad)*std::cos(lat2*rad)*std::sin(dlng/2)*std::sin(dlng/2);return 2*r*std::asin(std::sqrt(std::min(1.0,h)));}
std::unique_ptr<Razorpay> payments;
std::int64_t amountPaise(double rupees){return static_cast<std::int64_t>(std::llround(rupees*100));}
std::string text(const Input& value,const char* key){return value.has(key)&&value[key].t()==crow::json::type::String?std::string(value[key].s()):std::string();}
// Time-of-use pricing in India time: off-peak nights (22:00-06:00) cost 20% less and the evening
// peak (18:00-22:00) 20% more. A charge keeps the rate it started with. PLUGGO_TIME_OF_USE=off
// charges every station's base rate around the clock.
constexpr std::int64_t istOffset=19800000,dayMs=86400000;
struct Tariff {double multiplier=1;std::string band="standard",next="standard";std::int64_t until=0;};
bool timeOfUse(){const auto v=env("PLUGGO_TIME_OF_USE","on");return v!="off"&&v!="0"&&v!="false";}
Tariff tariffAt(std::int64_t ms){
 if(!timeOfUse())return {};
 const std::int64_t local=ms+istOffset,into=(local%60000+60000)%60000,minute=((local/60000)%1440+1440)%1440;
 auto until=[&](std::int64_t boundary){return ms-into+(boundary-minute)*60000;};
 if(minute<360)return {0.8,"off-peak","standard",until(360)};
 if(minute<1080)return {1.0,"standard","peak",until(1080)};
 if(minute<1320)return {1.2,"peak","off-peak",until(1320)};
 return {0.8,"off-peak","standard",until(1440+360)};
}
double rateFor(double base,const Tariff& tariff){return std::round(base*tariff.multiplier*100)/100;}
Json tariffJson(std::int64_t ms){
 const auto t=tariffAt(ms);Json j;j["enabled"]=timeOfUse();j["band"]=t.band;j["multiplier"]=t.multiplier;j["next"]=t.next;j["until"]=t.until?Json(t.until):Json(nullptr);
 Json::list bands;auto add=[&](const char* band,const char* from,const char* to,double multiplier){Json b;b["band"]=band;b["from"]=from;b["to"]=to;b["multiplier"]=timeOfUse()?multiplier:1.0;bands.push_back(std::move(b));};
 add("off-peak","22:00","06:00",0.8);add("standard","06:00","18:00",1.0);add("peak","18:00","22:00",1.2);j["bands"]=std::move(bands);return j;
}
// A booking holds its charger from 15 minutes before the slot until 10 minutes after it starts;
// a driver who has not started charging by then is a no-show and the charger is released.
constexpr std::int64_t bookingHold=15*60000,bookingGrace=10*60000;
const std::set<std::string> reportKinds{"not-working","blocked","damaged","payment","other"};
std::string cookieFor(const std::string& id){return "pluggo_guest="+id+"; HttpOnly; SameSite=Strict; Path=/api/customer; Max-Age=31536000"+(env("CHARGEFLOW_COOKIE_SECURE","0")=="1"?std::string("; Secure"):std::string());}
struct Session {
 std::string id,owner,station,connector,vehicle,key,request,reason,paymentId,band="standard";
 std::int64_t started=0,ended=0;double target=80,budget=300,power=0,energy=0,capacity=40,rate=18,limit=0,paid=0,refunded=0,walletUsed=0,startSoc=25,carSoc=-1;std::string model;
 // Battery now: the car's own reading when a DC charger reports it, otherwise estimated from energy added.
 double soc() const {return carSoc>=0?carSoc:std::min(100.0,startSoc+100*energy/capacity);}bool settled=false,walletReserved=false;
 Json json() const {Json j;j["band"]=band;j["walletUsed"]=walletUsed;j["walletReserved"]=walletReserved;if(settled)j["receipt"]["walletUsed"]=walletUsed;j["id"]=id;j["station"]=station;j["connector"]=connector;j["vehicle"]=vehicle;j["started"]=started;j["ended"]=ended?Json(ended):Json(nullptr);j["target"]=target;j["budget"]=budget;j["power"]=power;j["energy"]=energy;j["capacity"]=capacity;j["rate"]=rate;j["cost"]=energy*rate;j["limit"]=limit;j["currentSoc"]=soc();j["startSoc"]=startSoc;j["carSoc"]=carSoc>=0?Json(carSoc):Json(nullptr);j["model"]=model;j["settled"]=settled;j["reason"]=reason;j["paid"]=paid;j["refunded"]=refunded;j["paymentId"]=paymentId;j["backendOwned"]=true;if(settled){j["receipt"]["id"]="INV-"+id;j["receipt"]["amountCollected"]=paid;j["receipt"]["currency"]="INR";j["receipt"]["paymentId"]=paymentId;j["receipt"]["provider"]=paymentId.empty()?"none":"razorpay";j["receipt"]["refunded"]=refunded;j["receipt"]["netCollected"]=std::max(0.0,paid-refunded);}return j;}
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
 Session fromRow(const Row& row) {const auto j=crow::json::load(row[3]);Session s;s.id=row[0];s.owner=row[1];s.key=row[2];s.request=row[4];s.station=string(j,"station");s.connector=string(j,"connector");s.vehicle=string(j,"vehicle");s.started=static_cast<std::int64_t>(j["started"].d());s.ended=j["ended"].t()==crow::json::type::Null?0:static_cast<std::int64_t>(j["ended"].d());s.target=j["target"].d();s.budget=j["budget"].d();s.power=j["power"].d();s.energy=j["energy"].d();s.capacity=j["capacity"].d();s.rate=j["rate"].d();s.limit=j["limit"].d();s.settled=j["settled"].b();s.reason=string(j,"reason");s.paid=j.has("paid")?j["paid"].d():0;s.refunded=j.has("refunded")?j["refunded"].d():0;s.paymentId=string(j,"paymentId");s.walletUsed=j.has("walletUsed")?j["walletUsed"].d():0;s.walletReserved=j.has("walletReserved")&&j["walletReserved"].b();s.band=j.has("band")?string(j,"band"):"standard";s.startSoc=j.has("startSoc")?j["startSoc"].d():25;s.carSoc=j.has("carSoc")&&j["carSoc"].t()==crow::json::type::Number?j["carSoc"].d():-1;s.model=j.has("model")?string(j,"model"):"";return s;}
 std::vector<Session> sessions(const std::string& owner="") {std::vector<Session> values;auto rows=query("SELECT id,owner,idem,payload,request FROM customer_sessions"+(owner.empty()?std::string():" WHERE owner=?")+" ORDER BY started DESC",owner.empty()?Row{}:Row{owner});for(const auto& row:rows)values.push_back(fromRow(row));return values;}
 void persist(const Session& s) {query("INSERT INTO customer_sessions(id,owner,idem,request,connector,started,ended,settled,payload) VALUES(?,?,?,?,?,?,NULLIF(?,''),?,?) ON CONFLICT(id) DO UPDATE SET ended=excluded.ended,settled=excluded.settled,payload=excluded.payload",{s.id,s.owner,s.key,s.request,s.connector,std::to_string(s.started),s.ended?std::to_string(s.ended):"",s.settled?"1":"0",s.json().dump()});}
 void advance() {query("UPDATE customer_bookings SET status='no-show' WHERE status='booked' AND starts<?",{std::to_string(nowMs()-bookingGrace)});if(mode!="clock")return;for(auto s:sessions()){if(s.ended||real(s.connector))continue;const double elapsed=std::max<std::int64_t>(0,nowMs()-s.started)/1000.;s.energy=std::min(s.limit,elapsed*s.power*speed/3600.);complete(s);persist(s);}}
 void complete(Session& s) {if(s.energy+1e-9<s.limit)return;s.energy=s.limit;if(!s.ended)s.ended=mode=="clock"?s.started+static_cast<std::int64_t>(s.limit/s.power*3600000./speed):nowMs();s.reason=s.limit+1e-9>=s.budget/s.rate?"Budget limit reached":"Charge target reached";}
 struct ModelSpec{std::string name;double capacity,power;};
 // A specific model from the vehicle type's list (battery and charging power), or the type's own profile.
 ModelSpec modelSpec(const Input& v,const std::string& id){
  if(id.empty())return {string(v,"name"),v["capacity"].d(),v["power"].d()};
  if(v.has("models"))for(const auto& m:v["models"])if(std::string(m["id"].s())==id)return {std::string(m["name"].s()),m["capacity"].d(),m["power"].d()};
  throw ApiError(400,"Unknown vehicle model");
 }
 const Input& profile(const std::string& id) {if(!catalog["vehicles"].has(id))throw ApiError(400,"Unknown vehicle profile");return catalog["vehicles"][id];}
 bool busy(const std::string& id) {return !query("SELECT id FROM customer_sessions WHERE connector=? AND ended IS NULL",{id}).empty();}
 struct Connector {std::string station,id,type;double power,rate;bool enabled;};
 Connector connector(const std::string& id) {for(const auto& station:catalog["stations"])for(const auto& c:station["connectors"])if(std::string(c["id"].s())==id)return {std::string(station["id"].s()),id,std::string(c["type"].s()),c["power"].d(),station["rate"].d(),c["available"].b()};throw ApiError(404,"Charger code not found");}
 bool compatible(const Input& vehicle,const std::string& type) {for(const auto& c:vehicle["connectors"])if(std::string(c.s())==type)return true;return false;}
 bool simulatorOnline() const {return nowMs()-lastSimulator<15000;}
 // The driver whose booking holds this charger right now, or "" when no booking holds it.
 std::string holder(const std::string& id){const auto now=nowMs();const auto rows=query("SELECT owner FROM customer_bookings WHERE connector=? AND status='booked' AND starts<=? AND starts>=?",{id,std::to_string(now+bookingHold),std::to_string(now-bookingGrace)});return rows.empty()?std::string():rows[0][0];}
 void checkHold(const std::string& owner,const std::string& id){const auto h=holder(id);if(!h.empty()&&h!=owner)throw ApiError(409,"This charger is reserved for a booking. Pick another charger or book a later slot");}
 Json upcomingBookings(const std::string& id){Json::list list;const auto now=nowMs();for(const auto& r:query("SELECT starts,ends FROM customer_bookings WHERE connector=? AND status='booked' AND ends>? AND starts<? ORDER BY starts",{id,std::to_string(now),std::to_string(now+dayMs)})){Json j;j["starts"]=std::stoll(r[0]);j["ends"]=std::stoll(r[1]);list.push_back(std::move(j));}return Json(std::move(list));}
 Json bookingJson(const Row& r){Json j;j["id"]=r[0];j["station"]=r[1];j["connector"]=r[2];j["vehicle"]=r[3];j["starts"]=std::stoll(r[4]);j["ends"]=std::stoll(r[5]);j["status"]=r[6];j["session"]=r[7];j["created"]=std::stoll(r[8]);const auto t=tariffAt(std::stoll(r[4]));j["band"]=t.band;j["rate"]=rateFor(connector(r[2]).rate,t);return j;}
 std::int64_t openReports(const std::string& id){return std::stoll(query("SELECT COUNT(*) FROM charger_reports WHERE connector=? AND status='open'",{id})[0][0]);}
 std::string stationName(const std::string& id){for(const auto& s:catalog["stations"])if(std::string(s["id"].s())==id)return string(s,"name",id);return id;}
 bool knownStation(const std::string& id){for(const auto& s:catalog["stations"])if(std::string(s["id"].s())==id)return true;return false;}
 Json rating(const std::string& station,const std::string& owner,bool canReview){
  const auto total=query("SELECT COUNT(*),COALESCE(AVG(rating),0) FROM customer_reviews WHERE station=?",{station});Json j;j["count"]=std::stoll(total[0][0]);j["average"]=std::round(std::stod(total[0][1])*10)/10;j["canReview"]=canReview;
  Json::list recent;for(const auto& r:query("SELECT rating,comment,created FROM customer_reviews WHERE station=? AND comment<>'' ORDER BY created DESC LIMIT 3",{station})){Json x;x["rating"]=std::stoll(r[0]);x["comment"]=r[1];x["created"]=std::stoll(r[2]);recent.push_back(std::move(x));}j["recent"]=Json(std::move(recent));
  const auto mine=query("SELECT rating,comment FROM customer_reviews WHERE station=? AND owner=?",{station,owner});if(!mine.empty()){j["mine"]["rating"]=std::stoll(mine[0][0]);j["mine"]["comment"]=mine[0][1];}return j;}
 // Pluggo wallet, in paise: credits from operators (positive) and amounts used at checkout (negative).
 std::int64_t balance(const std::string& owner){return std::max<std::int64_t>(0,std::stoll(query("SELECT COALESCE(SUM(amount),0) FROM customer_wallet WHERE owner=?",{owner})[0][0]));}
 // Wallet credit is set aside the first time a session's bill is worked out, so the amount due
 // never changes under an open Razorpay order. It is taken from the wallet when the session settles.
 std::int64_t amountDue(Session& s){const auto cost=amountPaise(s.energy*s.rate);if(!s.walletReserved){s.walletUsed=std::min(balance(s.owner),cost)/100.0;s.walletReserved=true;persist(s);}return std::max<std::int64_t>(0,cost-amountPaise(s.walletUsed));}
 void chargeWallet(const Session& s){if(s.walletUsed>0)query("INSERT OR IGNORE INTO customer_wallet(id,owner,amount,reason,session,created) VALUES(?,?,?,?,?,?)",{"use-"+s.id,s.owner,std::to_string(-amountPaise(s.walletUsed)),"Used for charging at "+stationName(s.station),s.id,std::to_string(nowMs())});}
public:
 // Connectors wired to physical OCPP 1.6J chargers (PLUGGO_REAL_CONNECTORS). The OCPP gateway
 // reports their status; the simulator never meters them and the clock never advances them.
 struct ExternalState {std::string status="Unknown",error;bool online=false;std::int64_t at=0;};
 std::set<std::string> realConnectors;std::map<std::string,ExternalState> external;
 bool real(const std::string& id) const {return realConnectors.count(id)>0;}
 std::string realProblem(const std::string& id) const {
  const auto it=external.find(id);
  if(it==external.end()||!it->second.online||nowMs()-it->second.at>15000)return "This charger is offline right now";
  if(it->second.status!="Available"&&it->second.status!="Preparing")return "This charger is not ready ("+it->second.status+")";
  return "";}
 void connectorStatus(const Input& body){const auto id=string(body,"connector");if(!real(id))throw ApiError(400,"Not a real connector");auto& e=external[id];e.online=body.has("online")&&body["online"].b();e.status=string(body,"status","Unknown");e.error=string(body,"errorCode","");e.at=nowMs();}
 // The driver stopped at the charger (or it refused to start): finish the session with its final reading.
 void transactionEnded(const Input& body){lastSimulator=nowMs();const auto id=string(body,"sessionId");auto rows=query("SELECT id,owner,idem,payload,request FROM customer_sessions WHERE id=?",{id});if(rows.empty())throw ApiError(404,"Session not found");auto s=fromRow(rows[0]);if(s.ended)return;if(string(body,"connector")!=s.connector||!real(s.connector))throw ApiError(409,"Connector does not match session");const double energy=number(body,"energyKWh",s.energy);if(energy<0)throw ApiError(400,"Energy must be non-negative");s.energy=std::min(s.limit,std::max(s.energy,energy));s.ended=nowMs();s.reason=string(body,"reason","Stopped at the charger");if(s.reason.size()>120)s.reason.resize(120);persist(s);}
public:
 std::mutex mutex;std::string mode,key;double speed;std::int64_t lastSimulator=0;
 Store():mode(env("CHARGEFLOW_SIMULATION_MODE","clock")),key(env("CHARGEFLOW_SIMULATOR_KEY","local-simulator-key")),speed(std::stod(env("CHARGEFLOW_SIMULATION_SPEED","60"))) {
  if((mode!="clock"&&mode!="meter")||!std::isfinite(speed)||speed<=0||speed>600)throw std::runtime_error("Invalid simulation configuration");
  std::ifstream input(env("CHARGEFLOW_CATALOG_FILE",EV_CATALOG_FILE));std::ostringstream content;content<<input.rdbuf();catalog=crow::json::load(content.str());if(!catalog||!catalog.has("stations")||!catalog.has("vehicles"))throw std::runtime_error("Cannot load customer catalog");
  {std::string raw=env("PLUGGO_REAL_CONNECTORS",""),item;for(char& c:raw)if(c==',')c=' ';std::istringstream in(raw);while(in>>item){connector(item);realConnectors.insert(item);}}
  const auto path=env("CHARGEFLOW_CUSTOMER_DB","data/pluggo.sqlite3");if(path!=":memory:"){auto parent=std::filesystem::path(path).parent_path();if(!parent.empty())std::filesystem::create_directories(parent);}
  if(sqlite3_open(path.c_str(),&db)!=SQLITE_OK)throw std::runtime_error("Cannot open customer database");sqlite3_busy_timeout(db,5000);query("PRAGMA journal_mode=WAL");query("PRAGMA foreign_keys=ON");
  query("CREATE TABLE IF NOT EXISTS customer_visitors(id TEXT PRIMARY KEY,vehicle TEXT NOT NULL DEFAULT 'car',saved TEXT NOT NULL DEFAULT '[]')");
  query("CREATE TABLE IF NOT EXISTS customer_sessions(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES customer_visitors(id),idem TEXT NOT NULL,request TEXT NOT NULL,connector TEXT NOT NULL,started INTEGER NOT NULL,ended INTEGER,settled INTEGER NOT NULL DEFAULT 0,payload TEXT NOT NULL,UNIQUE(owner,idem))");
  query("CREATE UNIQUE INDEX IF NOT EXISTS customer_active_connector ON customer_sessions(connector) WHERE ended IS NULL");
  query("CREATE UNIQUE INDEX IF NOT EXISTS customer_unfinished_owner ON customer_sessions(owner) WHERE settled=0");
  // A signed-in phone account owns exactly one visitor row, so its history follows it across devices.
  query("CREATE TABLE IF NOT EXISTS customer_accounts(uid TEXT PRIMARY KEY,visitor TEXT NOT NULL UNIQUE REFERENCES customer_visitors(id),phone TEXT NOT NULL DEFAULT '',created INTEGER NOT NULL)");
  query("CREATE TABLE IF NOT EXISTS customer_payments(session TEXT PRIMARY KEY REFERENCES customer_sessions(id),owner TEXT NOT NULL,order_id TEXT NOT NULL UNIQUE,amount INTEGER NOT NULL,created INTEGER NOT NULL)");
  // Refunds issued by operators, and Razorpay webhook events already handled (each is processed once).
  query("CREATE TABLE IF NOT EXISTS customer_refunds(id TEXT PRIMARY KEY,session TEXT NOT NULL REFERENCES customer_sessions(id) ON DELETE CASCADE,amount INTEGER NOT NULL,status TEXT NOT NULL,reason TEXT NOT NULL,operator TEXT NOT NULL,created INTEGER NOT NULL)");
  query("CREATE TABLE IF NOT EXISTS razorpay_events(id TEXT PRIMARY KEY,created INTEGER NOT NULL)");
  query("CREATE TABLE IF NOT EXISTS customer_bookings(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES customer_visitors(id),station TEXT NOT NULL,connector TEXT NOT NULL,vehicle TEXT NOT NULL,starts INTEGER NOT NULL,ends INTEGER NOT NULL,status TEXT NOT NULL,session TEXT NOT NULL DEFAULT '',created INTEGER NOT NULL)");
  query("CREATE INDEX IF NOT EXISTS customer_bookings_connector ON customer_bookings(connector,status,starts)");
  query("CREATE TABLE IF NOT EXISTS customer_wallet(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES customer_visitors(id),amount INTEGER NOT NULL,reason TEXT NOT NULL,session TEXT NOT NULL DEFAULT '',created INTEGER NOT NULL)");
  query("CREATE TABLE IF NOT EXISTS customer_reviews(owner TEXT NOT NULL REFERENCES customer_visitors(id),station TEXT NOT NULL,rating INTEGER NOT NULL,comment TEXT NOT NULL DEFAULT '',created INTEGER NOT NULL,PRIMARY KEY(owner,station))");
  // Reports outlive the account that filed them (owner becomes 'erased'), so operators keep the fault history.
  query("CREATE TABLE IF NOT EXISTS charger_reports(id TEXT PRIMARY KEY,owner TEXT NOT NULL,station TEXT NOT NULL,connector TEXT NOT NULL DEFAULT '',kind TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',status TEXT NOT NULL,created INTEGER NOT NULL,resolved INTEGER,resolution TEXT NOT NULL DEFAULT '',credit INTEGER NOT NULL DEFAULT 0,operator TEXT NOT NULL DEFAULT '')");
 }
 bool signedIn(const std::string& owner){return !query("SELECT uid FROM customer_accounts WHERE visitor=?",{owner}).empty();}
 std::string newVisitor(){const auto id=randomId();query("INSERT INTO customer_visitors(id) VALUES(?)",{id});return id;}
 // Links the browser's visitor to a phone account. Returns the visitor ID the browser must switch to, or "" to keep its own.
 std::string signIn(const std::string& owner,const FirebaseUser& user){
  const auto account=query("SELECT visitor FROM customer_accounts WHERE uid=?",{user.uid});
  if(!account.empty()){query("UPDATE customer_accounts SET phone=? WHERE uid=?",{user.phone,user.uid});return account[0][0]==owner?std::string():account[0][0];}
  const auto target=signedIn(owner)?newVisitor():owner;
  query("INSERT INTO customer_accounts(uid,visitor,phone,created) VALUES(?,?,?,?)",{user.uid,target,user.phone,std::to_string(nowMs())});
  return target==owner?std::string():target;
 }
 Session owned(const std::string& owner,const std::string& id){auto rows=query("SELECT id,owner,idem,payload,request FROM customer_sessions WHERE id=? AND owner=?",{id,owner});if(rows.empty())throw ApiError(404,"Session not found");return fromRow(rows[0]);}
 // Amount due for an ended, unsettled session, plus any Razorpay order already created for it.
 std::pair<std::int64_t,std::string> paymentQuote(const std::string& owner,const std::string& id){advance();auto s=owned(owner,id);if(!s.ended)throw ApiError(409,"Stop charging before paying");if(s.settled)throw ApiError(409,"This session is already paid");const auto existing=query("SELECT order_id,amount FROM customer_payments WHERE session=?",{id});const auto due=amountDue(s);if(!existing.empty()&&std::stoll(existing[0][1])==due)return {due,existing[0][0]};if(!existing.empty())query("DELETE FROM customer_payments WHERE session=?",{id});return {due,""};}
 void recordOrder(const std::string& owner,const std::string& id,const std::string& order,std::int64_t amount){owned(owner,id);query("INSERT INTO customer_payments(session,owner,order_id,amount,created) VALUES(?,?,?,?,?) ON CONFLICT(session) DO UPDATE SET order_id=excluded.order_id,amount=excluded.amount,created=excluded.created",{id,owner,order,std::to_string(amount),std::to_string(nowMs())});}
 std::string phone(const std::string& owner){const auto rows=query("SELECT phone FROM customer_accounts WHERE visitor=?",{owner});return rows.empty()?std::string():rows[0][0];}
 bool settledSession(const std::string& owner,const std::string& id){return owned(owner,id).settled;}
 // Settles the session behind a Razorpay order once Razorpay itself confirms the payment
 // (webhook or order lookup), so a customer who paid and closed the app is never asked again.
 // Returns false when the order is unknown here.
 bool settleFromProvider(const std::string& orderId,const std::string& paymentId,std::int64_t amount){
  const auto row=query("SELECT session,owner,amount FROM customer_payments WHERE order_id=?",{orderId});if(row.empty())return false;
  if(std::stoll(row[0][2])!=amount)throw ApiError(409,"Payment amount does not match the order");
  auto s=owned(row[0][1],row[0][0]);if(s.settled)return true;if(!s.ended)throw ApiError(409,"Session is still charging");
  s.paid=amount/100.0;s.paymentId=paymentId;s.settled=true;persist(s);chargeWallet(s);return true;}
 bool eventSeen(const std::string& id){return !query("SELECT id FROM razorpay_events WHERE id=?",{id}).empty();}
 void markEvent(const std::string& id){query("INSERT OR IGNORE INTO razorpay_events(id,created) VALUES(?,?)",{id,std::to_string(nowMs())});}
 struct RefundTarget {std::string paymentId;std::int64_t refundable=0;};
 RefundTarget refundTarget(const std::string& id,std::int64_t amount){
  const auto rows=query("SELECT id,owner,idem,payload,request FROM customer_sessions WHERE id=?",{id});if(rows.empty())throw ApiError(404,"Session not found");
  const auto s=fromRow(rows[0]);if(!s.settled||s.paymentId.empty())throw ApiError(409,"Only sessions paid through Razorpay can be refunded");
  const auto refundable=amountPaise(s.paid)-amountPaise(s.refunded);if(refundable<=0)throw ApiError(409,"This session is already fully refunded");
  if(amount<=0||amount>refundable)throw ApiError(400,"Refund must be between ₹0.01 and the amount still refundable");
  return {s.paymentId,refundable};}
 void recordRefund(const std::string& id,const std::string& refundId,std::int64_t amount,const std::string& reason,const std::string& operatorPhone){
  const auto rows=query("SELECT id,owner,idem,payload,request FROM customer_sessions WHERE id=?",{id});if(rows.empty())throw ApiError(404,"Session not found");
  auto s=fromRow(rows[0]);query("INSERT OR IGNORE INTO customer_refunds(id,session,amount,status,reason,operator,created) VALUES(?,?,?,?,?,?,?)",{refundId,id,std::to_string(amount),"pending",reason,operatorPhone,std::to_string(nowMs())});
  s.refunded=(amountPaise(s.refunded)+amount)/100.0;persist(s);}
 void refundStatus(const std::string& refundId,const std::string& status){query("UPDATE customer_refunds SET status=? WHERE id=?",{status,refundId});}
 Json refunds(const std::string& id){Json::list items;for(const auto& r:query("SELECT id,amount,status,reason,created FROM customer_refunds WHERE session=? ORDER BY created",{id})){Json j;j["id"]=r[0];j["amount"]=std::stoll(r[1])/100.0;j["status"]=r[2];j["reason"]=r[3];j["created"]=std::stoll(r[4]);items.push_back(std::move(j));}return Json(std::move(items));}
 ~Store(){if(db)sqlite3_close(db);}
 Json health(){query("SELECT COUNT(*) FROM customer_visitors");Json j;j["ok"]=true;j["database"]="sqlite";j["identityProvider"]=firebase->enabled()?"firebase-phone":"local-visitor-cookie";j["payments"]=payments->enabled()?"razorpay":"none";j["productionOidc"]=false;j["simulationMode"]=mode;j["simulatorConnected"]=simulatorOnline();const char* backup=std::getenv("PLUGGO_BACKUP");j["backup"]=backup&&*backup?backup:"none";return j;}
 void begin(){query("BEGIN IMMEDIATE");}void commit(){query("COMMIT");}void rollback(){try{query("ROLLBACK");}catch(...){}}
 std::string visitor(const crow::request& request,bool create,bool& fresh) {const auto cookie=request.get_header_value("Cookie");std::string id;std::istringstream stream(cookie);std::string part;while(std::getline(stream,part,';')){const auto first=part.find_first_not_of(' ');if(first!=std::string::npos&&part.compare(first,13,"pluggo_guest=")==0)id=part.substr(first+13);}
  if(id.size()==32&&id.find_first_not_of("0123456789abcdef")==std::string::npos&&!query("SELECT id FROM customer_visitors WHERE id=?",{id}).empty())return id;
  if(!create)throw ApiError(401,"Open the app again to establish your visitor session");id=randomId();query("INSERT INTO customer_visitors(id) VALUES(?)",{id});fresh=true;return id;
 }
 Json snapshot(const std::string& owner) {advance();Json result;result["ok"]=true;const auto prefs=query("SELECT vehicle,saved FROM customer_visitors WHERE id=?",{owner});if(prefs.empty())throw ApiError(401,"Visitor not found");result["state"]["vehicle"]=prefs[0][0];result["state"]["saved"]=Json(crow::json::load(prefs[0][1]));Json::list list;std::set<std::string> visited;const auto wallet=balance(owner);
  for(const auto& s:sessions(owner)){auto item=s.json();if(s.ended)visited.insert(s.station);
   // What the driver will actually pay once wallet credit is applied.
   if(s.ended&&!s.settled){const auto cost=amountPaise(s.energy*s.rate);const auto use=s.walletReserved?amountPaise(s.walletUsed):std::min(wallet,cost);item["walletUse"]=use/100.0;item["due"]=std::max<std::int64_t>(0,cost-use)/100.0;}
   // When a simulated charge will finish, so the phone can schedule a "charge complete" alert.
   if(!s.ended&&mode=="clock"&&!real(s.connector)&&s.power>0)item["expectedEnd"]=s.started+static_cast<std::int64_t>(s.limit/s.power*3600000./speed);
   list.push_back(std::move(item));}
  result["state"]["sessions"]=std::move(list);result["catalog"]=Json(catalog);
  const auto now=nowMs();const auto tariff=tariffAt(now);result["tariff"]=tariffJson(now);
  int index=0;for(const auto& station:catalog["stations"]){auto& out=result["catalog"]["stations"][index];const std::string sid=station["id"].s();out["currentRate"]=rateFor(station["rate"].d(),tariff);out["band"]=tariff.band;out["rating"]=rating(sid,owner,visited.count(sid)>0);
   int ci=0;for(const auto& c:station["connectors"]){auto con=connector(std::string(c["id"].s()));const auto h=holder(con.id);auto& slot=out["connectors"][ci];
    slot["available"]=con.enabled&&!busy(con.id)&&(h.empty()||h==owner)&&(real(con.id)?realProblem(con.id).empty():(mode=="clock"||simulatorOnline()));slot["ocpp"]=real(con.id);
    slot["reserved"]=!h.empty()&&h!=owner;slot["bookedByYou"]=!h.empty()&&h==owner;slot["bookings"]=upcomingBookings(con.id);slot["openReports"]=openReports(con.id);++ci;}++index;}
  {Json::list bookings;for(const auto& r:query("SELECT id,station,connector,vehicle,starts,ends,status,session,created FROM customer_bookings WHERE owner=? ORDER BY starts DESC LIMIT 10",{owner}))bookings.push_back(bookingJson(r));result["state"]["bookings"]=Json(std::move(bookings));}
  {Json::list reports;for(const auto& r:query("SELECT id,station,connector,kind,note,status,created,resolved,resolution,credit FROM charger_reports WHERE owner=? ORDER BY created DESC LIMIT 10",{owner})){Json j;j["id"]=r[0];j["station"]=r[1];j["connector"]=r[2];j["kind"]=r[3];j["note"]=r[4];j["status"]=r[5];j["created"]=std::stoll(r[6]);j["resolved"]=r[7].empty()?Json(nullptr):Json(static_cast<std::int64_t>(std::stoll(r[7])));j["resolution"]=r[8];j["credit"]=std::stoll(r[9])/100.0;reports.push_back(std::move(j));}result["state"]["reports"]=Json(std::move(reports));}
  {result["wallet"]["balance"]=wallet/100.0;Json::list history;for(const auto& r:query("SELECT id,amount,reason,session,created FROM customer_wallet WHERE owner=? ORDER BY created DESC LIMIT 20",{owner})){Json j;j["id"]=r[0];j["amount"]=std::stoll(r[1])/100.0;j["reason"]=r[2];j["session"]=r[3];j["created"]=std::stoll(r[4]);history.push_back(std::move(j));}result["wallet"]["history"]=Json(std::move(history));}
  result["account"]["signedIn"]=signedIn(owner);result["account"]["phone"]=phone(owner);
  result["backend"]["authRequired"]=firebase->enabled();if(firebase->enabled()){result["backend"]["firebase"]["projectId"]=firebase->projectId();result["backend"]["firebase"]["apiKey"]=env("PLUGGO_FIREBASE_API_KEY","");result["backend"]["firebase"]["authDomain"]=env("PLUGGO_FIREBASE_AUTH_DOMAIN",firebase->projectId()+".firebaseapp.com");result["backend"]["firebase"]["appId"]=env("PLUGGO_FIREBASE_APP_ID","");}
  result["backend"]["payments"]=payments->enabled()?"razorpay":"none";
  result["backend"]["storage"]="sqlite";result["backend"]["simulationMode"]=mode;result["backend"]["simulationSpeed"]=speed;result["backend"]["simulatorConnected"]=simulatorOnline();result["backend"]["serverTime"]=nowMs();return result;
 }
 Json operatorStation() {
  advance();const auto all=sessions();Json j;j["ok"]=true;j["dataSource"]="customer-sessions";j["simulated"]=true;j["simulatorConnected"]=simulatorOnline();j["serverTime"]=nowMs();
  double power=0,energy=0,cost=0;Json::list slots,recent;
  for(const auto& s:all){energy+=s.energy;cost+=s.energy*s.rate;if(!s.ended)power+=s.power;if(recent.size()<10){auto item=s.json();item["vehicleName"]=string(profile(s.vehicle),"name",s.vehicle);recent.push_back(std::move(item));}}
  for(const auto& station:catalog["stations"])for(const auto& c:station["connectors"]){
   const std::string id=c["id"].s();const Session* active=nullptr;for(const auto& s:all)if(s.connector==id&&!s.ended){active=&s;break;}
   Json slot;slot["id"]=id;slot["stationName"]=string(station,"name",std::string(station["id"].s()));slot["connector"]=std::string(c["type"].s());slot["source"]=real(id)?"OCPP 1.6J":"SIMULATOR";if(real(id)){const auto e=external.find(id);slot["chargerStatus"]=e==external.end()?"Unknown":e->second.status;slot["chargerOnline"]=e!=external.end()&&e->second.online&&nowMs()-e->second.at<=15000;}
   const auto held=holder(id);slot["openReports"]=openReports(id);slot["bookings"]=upcomingBookings(id);
   slot["status"]=active?"occupied":!c["available"].b()?"disabled":!held.empty()?"reserved":real(id)?(realProblem(id).empty()?"available":"offline"):mode=="meter"&&!simulatorOnline()?"offline":"available";
   slot["vehicle"]=active?string(profile(active->vehicle),"name",active->vehicle):"";slot["soc"]=active?active->soc():0;slot["model"]=active?active->model:"";slot["carReading"]=active&&active->carSoc>=0;slot["powerKW"]=active?active->power:0;slot["energyKWh"]=active?active->energy:0;slot["estimatedCost"]=active?active->energy*active->rate:0;slots.push_back(std::move(slot));
  }
  j["slots"]=std::move(slots);j["recentSessions"]=std::move(recent);j["activePowerKW"]=power;j["energyKWh"]=energy;j["estimatedCost"]=cost;j["solarShare"]=0;return j;
 }
 void preferences(const std::string& owner,const Input& body) {const auto vehicle=string(body,"vehicle");profile(vehicle);if(!body.has("saved")||body["saved"].t()!=crow::json::type::List||body["saved"].size()>20)throw ApiError(400,"Invalid saved stations");Json::list saved;for(const auto& item:body["saved"]){if(item.t()!=crow::json::type::String)throw ApiError(400,"Invalid station ID");const std::string id=item.s();bool found=false;for(const auto& s:catalog["stations"])if(std::string(s["id"].s())==id)found=true;if(!found)throw ApiError(400,"Unknown saved station");saved.emplace_back(id);}query("UPDATE customer_visitors SET vehicle=?,saved=? WHERE id=?",{vehicle,Json(std::move(saved)).dump(),owner});}
 Json verify(const std::string& owner,const Input& body) {advance();const auto con=connector(string(body,"connector"));const auto& v=profile(string(body,"vehicle"));if(con.station!=string(body,"station"))throw ApiError(400,"Charger does not belong to this station");if(!compatible(v,con.type))throw ApiError(409,"Connector is incompatible with this vehicle");if(!con.enabled||busy(con.id))throw ApiError(409,"Connector is in use");checkHold(owner,con.id);if(real(con.id)){const auto problem=realProblem(con.id);if(!problem.empty())throw ApiError(409,problem);}else if(mode=="meter"&&!simulatorOnline())throw ApiError(409,"Charging simulator is offline");Json j;j["ok"]=true;j["connector"]=con.id;return j;}
 std::string start(const std::string& owner,const Input& body,const std::string& idem) {advance();if(firebase->enabled()&&!signedIn(owner))throw ApiError(403,"Sign in with your phone number to start charging");if(idem.empty()||idem.size()>128)throw ApiError(400,"A valid Idempotency-Key is required");const auto vehicle=string(body,"vehicle"),charger=string(body,"connector");const double target=number(body,"target",80),budget=number(body,"budget",300);if(target<30||target>100||budget<50||budget>1000)throw ApiError(400,"Target must be 30–100 and budget 50–1000");const auto& v=profile(vehicle);
  // The driver's battery now (default 25% for older apps) and their exact model, if they chose one.
  const double startSoc=number(body,"startSoc",25);if(startSoc<0||startSoc>95)throw ApiError(400,"Battery now must be 0–95%");if(target<startSoc+5)throw ApiError(400,"Set a charge target at least 5% above your battery now");
  const auto modelId=string(body,"model");const auto spec=modelSpec(v,modelId);const auto c=connector(charger);const auto station=string(body,"station");if(c.station!=station)throw ApiError(400,"Charger does not belong to this station");std::ostringstream normalized;normalized<<std::setprecision(std::numeric_limits<double>::max_digits10)<<vehicle<<'|'<<charger<<'|'<<target<<'|'<<budget<<'|'<<modelId<<'|'<<startSoc;auto previous=query("SELECT id,request FROM customer_sessions WHERE owner=? AND idem=?",{owner,idem});if(!previous.empty()){if(previous[0][1]!=normalized.str())throw ApiError(409,"Idempotency key was used for another request");return previous[0][0];}
  if(!compatible(v,c.type))throw ApiError(409,"Vehicle and connector are incompatible");if(!c.enabled||busy(c.id))throw ApiError(409,"Charger is no longer available");checkHold(owner,c.id);if(real(c.id)){const auto problem=realProblem(c.id);if(!problem.empty())throw ApiError(409,problem);}else if(mode=="meter"&&!simulatorOnline())throw ApiError(409,"Charging simulator is offline");if(!query("SELECT id FROM customer_sessions WHERE owner=? AND settled=0",{owner}).empty())throw ApiError(409,"Finish your existing session or checkout first");
  Session s;s.id="PG-"+randomId();s.owner=owner;s.station=station;s.connector=charger;s.vehicle=vehicle;s.key=idem;s.request=normalized.str();s.started=nowMs();s.target=target;s.budget=budget;s.capacity=spec.capacity;s.power=std::min(spec.power,c.power);s.model=spec.name;s.startSoc=startSoc;const auto tariff=tariffAt(s.started);s.rate=rateFor(c.rate,tariff);s.band=tariff.band;s.limit=std::min((target-startSoc)/100*s.capacity,budget/s.rate);persist(s);
  // Starting on the charger you booked fulfils the booking.
  const auto now=nowMs();query("UPDATE customer_bookings SET status='used',session=? WHERE owner=? AND connector=? AND status='booked' AND starts<=? AND starts>=?",{s.id,owner,c.id,std::to_string(now+bookingHold),std::to_string(now-bookingGrace)});return s.id;
 }
 void action(const std::string& owner,const std::string& id,bool checkout,const Input* payment=nullptr) {advance();auto s=owned(owner,id);
  if(checkout){if(!s.ended)throw ApiError(409,"Stop charging before checkout");if(s.settled)return;const auto due=amountDue(s);
   // Charges under ₹1 are below Razorpay's minimum order and settle without a payment.
   if(payments->enabled()&&due>=100){
    if(!payment||!payment->has("razorpay_payment_id"))throw ApiError(409,"Payment is required to finish this session");
    const auto order=query("SELECT order_id,amount FROM customer_payments WHERE session=? AND owner=?",{id,owner});if(order.empty())throw ApiError(409,"Start the payment again");
    const auto orderId=string(*payment,"razorpay_order_id"),paymentId=string(*payment,"razorpay_payment_id"),signature=string(*payment,"razorpay_signature");
    if(orderId!=order[0][0]||std::stoll(order[0][1])!=due)throw ApiError(409,"Payment does not match this session");
    if(!payments->verifySignature(orderId,paymentId,signature))throw ApiError(400,"Payment could not be verified");
    s.paid=due/100.0;s.paymentId=paymentId;}
   s.settled=true;chargeWallet(s);}
  else if(!s.ended){s.ended=nowMs();s.reason="Stopped by you";}persist(s);}
 // Right to erasure (DPDP Act 2023; Play Store account deletion). Removes the phone account,
 // preferences, unpaid history and the visitor itself. Paid receipts must be kept for tax
 // records, so they stay only as anonymous accounting entries, no longer linked to anyone.
 void eraseAccount(const std::string& owner){
  if(!query("SELECT id FROM customer_sessions WHERE owner=? AND ended IS NULL",{owner}).empty())throw ApiError(409,"Stop charging before deleting your account");
  if(!query("SELECT id FROM customer_sessions WHERE owner=? AND settled=0",{owner}).empty())throw ApiError(409,"Finish checkout for your last charge before deleting your account");
  query("INSERT OR IGNORE INTO customer_visitors(id) VALUES('erased')");
  for(const auto& s:sessions(owner)){
   if(!s.paymentId.empty())query("UPDATE customer_sessions SET owner='erased',idem=id WHERE id=?",{s.id});
   else{query("DELETE FROM customer_refunds WHERE session=?",{s.id});query("DELETE FROM customer_sessions WHERE id=?",{s.id});}
  }
  query("DELETE FROM customer_payments WHERE owner=?",{owner});
  query("DELETE FROM customer_bookings WHERE owner=?",{owner});
  query("DELETE FROM customer_wallet WHERE owner=?",{owner});
  query("DELETE FROM customer_reviews WHERE owner=?",{owner});
  query("UPDATE charger_reports SET owner='erased',note='' WHERE owner=?",{owner});
  query("DELETE FROM customer_accounts WHERE visitor=?",{owner});
  query("DELETE FROM customer_visitors WHERE id=?",{owner});
 }
 void reset(const std::string& owner) {query("DELETE FROM customer_refunds WHERE session IN (SELECT id FROM customer_sessions WHERE owner=?)",{owner});query("DELETE FROM customer_payments WHERE owner=?",{owner});query("DELETE FROM customer_sessions WHERE owner=?",{owner});query("DELETE FROM customer_bookings WHERE owner=?",{owner});query("UPDATE customer_visitors SET vehicle='car',saved='[]' WHERE id=?",{owner});}
 // ---- Bookings -------------------------------------------------------------------------------
 std::string book(const std::string& owner,const Input& body){
  advance();if(firebase->enabled()&&!signedIn(owner))throw ApiError(403,"Sign in with your phone number to book a charger");
  const auto c=connector(string(body,"connector"));const auto station=string(body,"station");if(c.station!=station)throw ApiError(400,"Charger does not belong to this station");
  const auto vehicle=string(body,"vehicle");if(!compatible(profile(vehicle),c.type))throw ApiError(409,"This charger does not fit your vehicle");if(!c.enabled)throw ApiError(409,"This charger is out of service");
  const double minutes=number(body,"minutes",60),startValue=number(body,"start",0);if(minutes!=30&&minutes!=60&&minutes!=90&&minutes!=120)throw ApiError(400,"Book 30, 60, 90 or 120 minutes");
  const auto now=nowMs();const auto starts=static_cast<std::int64_t>(startValue),ends=starts+static_cast<std::int64_t>(minutes)*60000;
  if(starts<now-60000||starts>now+dayMs)throw ApiError(400,"Pick a start time within the next 24 hours");
  if(!query("SELECT id FROM customer_bookings WHERE owner=? AND status='booked'",{owner}).empty())throw ApiError(409,"You already have a booking. Cancel it to book another slot");
  if(!query("SELECT id FROM customer_bookings WHERE connector=? AND status='booked' AND starts<? AND ends>?",{c.id,std::to_string(ends),std::to_string(starts)}).empty())throw ApiError(409,"That slot is already booked. Pick another time");
  if(starts<=now+bookingHold&&busy(c.id))throw ApiError(409,"This charger is in use right now. Pick a later slot");
  const auto id="BK-"+randomId().substr(0,12);
  query("INSERT INTO customer_bookings(id,owner,station,connector,vehicle,starts,ends,status,created) VALUES(?,?,?,?,?,?,?,'booked',?)",{id,owner,station,c.id,vehicle,std::to_string(starts),std::to_string(ends),std::to_string(now)});return id;}
 void cancelBooking(const std::string& owner,const std::string& id){const auto rows=query("SELECT status FROM customer_bookings WHERE id=? AND owner=?",{id,owner});if(rows.empty())throw ApiError(404,"Booking not found");if(rows[0][0]!="booked")throw ApiError(409,"This booking is no longer active");query("UPDATE customer_bookings SET status='cancelled' WHERE id=?",{id});}
 // ---- Ratings and fault reports ----------------------------------------------------------------
 void review(const std::string& owner,const std::string& station,const Input& body){
  if(!knownStation(station))throw ApiError(404,"Station not found");
  const double stars=number(body,"rating",0);if(stars<1||stars>5||std::floor(stars)!=stars)throw ApiError(400,"Rate the station from 1 to 5 stars");
  const auto comment=string(body,"comment","");if(comment.size()>1000)throw ApiError(400,"Keep your comment under 280 characters");
  bool visited=false;for(const auto& s:sessions(owner))if(s.station==station&&s.ended)visited=true;if(!visited)throw ApiError(403,"Charge at this station before rating it");
  query("INSERT INTO customer_reviews(owner,station,rating,comment,created) VALUES(?,?,?,?,?) ON CONFLICT(owner,station) DO UPDATE SET rating=excluded.rating,comment=excluded.comment,created=excluded.created",{owner,station,std::to_string(static_cast<int>(stars)),comment,std::to_string(nowMs())});}
 std::string report(const std::string& owner,const Input& body){
  const auto station=string(body,"station"),id=string(body,"connector",""),kind=string(body,"kind"),note=string(body,"note","");
  if(!knownStation(station))throw ApiError(404,"Station not found");if(!id.empty()&&connector(id).station!=station)throw ApiError(400,"Charger does not belong to this station");
  if(!reportKinds.count(kind))throw ApiError(400,"Choose what is wrong");if(note.size()>1000)throw ApiError(400,"Keep your note under 280 characters");
  if(std::stoll(query("SELECT COUNT(*) FROM charger_reports WHERE owner=? AND status='open'",{owner})[0][0])>=5)throw ApiError(429,"You already have 5 open reports. We will look at them soon");
  const auto reportId="RP-"+randomId().substr(0,12);
  query("INSERT INTO charger_reports(id,owner,station,connector,kind,note,status,created) VALUES(?,?,?,?,?,?,'open',?)",{reportId,owner,station,id,kind,note,std::to_string(nowMs())});return reportId;}
 Json operatorReports(){Json j;j["ok"]=true;Json::list items;
  for(const auto& r:query("SELECT id,station,connector,kind,note,status,created,resolved,resolution,credit,operator FROM charger_reports ORDER BY status='open' DESC,created DESC LIMIT 100")){Json x;x["id"]=r[0];x["station"]=r[1];x["stationName"]=stationName(r[1]);x["connector"]=r[2];x["kind"]=r[3];x["note"]=r[4];x["status"]=r[5];x["created"]=std::stoll(r[6]);x["resolved"]=r[7].empty()?Json(nullptr):Json(static_cast<std::int64_t>(std::stoll(r[7])));x["resolution"]=r[8];x["credit"]=std::stoll(r[9])/100.0;x["operator"]=r[10];items.push_back(std::move(x));}
  j["reports"]=Json(std::move(items));j["open"]=std::stoll(query("SELECT COUNT(*) FROM charger_reports WHERE status='open'")[0][0]);return j;}
 void resolveReport(const std::string& id,const std::string& operatorPhone,std::int64_t creditPaise,const std::string& resolution){
  const auto rows=query("SELECT owner,station,status FROM charger_reports WHERE id=?",{id});if(rows.empty())throw ApiError(404,"Report not found");if(rows[0][2]!="open")throw ApiError(409,"This report is already resolved");
  query("UPDATE charger_reports SET status='resolved',resolved=?,resolution=?,credit=?,operator=? WHERE id=?",{std::to_string(nowMs()),resolution,std::to_string(creditPaise),operatorPhone,id});
  if(creditPaise>0&&rows[0][0]!="erased")credit(rows[0][0],creditPaise,"Sorry about the problem at "+stationName(rows[0][1]));}
 // ---- Wallet -----------------------------------------------------------------------------------
 void credit(const std::string& owner,std::int64_t paise,const std::string& reason,const std::string& session=""){if(paise<=0||owner=="erased")return;query("INSERT INTO customer_wallet(id,owner,amount,reason,session,created) VALUES(?,?,?,?,?,?)",{"CR-"+randomId().substr(0,16),owner,std::to_string(paise),reason,session,std::to_string(nowMs())});}
 void creditForSession(const std::string& sessionId,std::int64_t paise,const std::string& reason){const auto rows=query("SELECT owner FROM customer_sessions WHERE id=?",{sessionId});if(rows.empty())throw ApiError(404,"Session not found");if(rows[0][0]=="erased")throw ApiError(409,"This customer deleted their account");credit(rows[0][0],paise,reason,sessionId);}
 // ---- Operator analytics -----------------------------------------------------------------------
 Json analytics(int days){
  advance();const auto now=nowMs();const auto today=(now+istOffset)/dayMs,first=today-days+1;
  struct Day {std::int64_t sessions=0;double energy=0,revenue=0;};std::vector<Day> daily(static_cast<std::size_t>(days));std::vector<double> busyMinutes(24,0);
  struct Totals {std::int64_t sessions=0;double energy=0,revenue=0;};std::map<std::string,Totals> byStation,byBand;
  double energy=0,billed=0,collected=0,refunded=0,wallet=0;std::int64_t completed=0,active=0;
  for(const auto& s:sessions()){
   if(!s.ended){++active;continue;}const auto day=(s.ended+istOffset)/dayMs;if(day<first||day>today)continue;
   const double cost=s.energy*s.rate;++completed;energy+=s.energy;billed+=cost;collected+=s.paid;refunded+=s.refunded;wallet+=s.walletUsed;
   auto& d=daily[static_cast<std::size_t>(day-first)];++d.sessions;d.energy+=s.energy;d.revenue+=cost;
   for(auto* t:{&byStation[s.station],&byBand[s.band]}){++t->sessions;t->energy+=s.energy;t->revenue+=cost;}
   // Spread the time on the charger over the India-time hours it covered.
   for(std::int64_t t=s.started;t<s.ended;){const auto local=t+istOffset;const auto next=std::min<std::int64_t>(s.ended,t+3600000-local%3600000);busyMinutes[static_cast<std::size_t>(local/3600000%24)]+=(next-t)/60000.0;t=next;}
  }
  std::size_t connectors=0;for(const auto& station:catalog["stations"])connectors+=station["connectors"].size();
  Json j;j["ok"]=true;j["days"]=days;j["serverTime"]=now;j["tariff"]=tariffJson(now);
  j["totals"]["completedSessions"]=completed;j["totals"]["activeSessions"]=active;j["totals"]["energyKWh"]=energy;j["totals"]["billed"]=billed;j["totals"]["collected"]=collected;j["totals"]["refunded"]=refunded;j["totals"]["walletUsed"]=wallet;j["totals"]["averageKWh"]=completed?energy/completed:0.0;
  const auto ratingRow=query("SELECT COUNT(*),COALESCE(AVG(rating),0) FROM customer_reviews");j["totals"]["ratings"]=std::stoll(ratingRow[0][0]);j["totals"]["averageRating"]=std::round(std::stod(ratingRow[0][1])*10)/10;
  j["totals"]["openReports"]=std::stoll(query("SELECT COUNT(*) FROM charger_reports WHERE status='open'")[0][0]);
  const auto since=std::to_string((first*dayMs)-istOffset);
  for(const char* status:{"booked","used","no-show","cancelled"})j["bookings"][status]=std::stoll(query("SELECT COUNT(*) FROM customer_bookings WHERE status=? AND created>=?",{status,since})[0][0]);
  Json::list dayList;for(std::size_t i=0;i<daily.size();++i){const std::time_t seconds=static_cast<std::time_t>((first+static_cast<std::int64_t>(i))*(dayMs/1000));char label[16]{};std::strftime(label,sizeof label,"%Y-%m-%d",std::gmtime(&seconds));Json d;d["date"]=label;d["sessions"]=daily[i].sessions;d["energyKWh"]=daily[i].energy;d["revenue"]=daily[i].revenue;dayList.push_back(std::move(d));}
  j["daily"]=Json(std::move(dayList));
  Json::list hours;for(std::size_t h=0;h<24;++h){Json x;x["hour"]=static_cast<std::int64_t>(h);x["busyMinutes"]=busyMinutes[h];x["utilisation"]=connectors?busyMinutes[h]/(static_cast<double>(connectors)*days*60)*100:0.0;hours.push_back(std::move(x));}j["hourly"]=Json(std::move(hours));
  Json::list stationList;for(const auto& station:catalog["stations"]){const std::string id=station["id"].s();const auto& t=byStation[id];const auto r=query("SELECT COUNT(*),COALESCE(AVG(rating),0) FROM customer_reviews WHERE station=?",{id});Json x;x["id"]=id;x["name"]=stationName(id);x["sessions"]=t.sessions;x["energyKWh"]=t.energy;x["revenue"]=t.revenue;x["ratings"]=std::stoll(r[0][0]);x["averageRating"]=std::round(std::stod(r[0][1])*10)/10;stationList.push_back(std::move(x));}j["stations"]=Json(std::move(stationList));
  Json::list bandList;for(const char* band:{"off-peak","standard","peak"}){const auto& t=byBand[band];Json x;x["band"]=band;x["sessions"]=t.sessions;x["energyKWh"]=t.energy;x["revenue"]=t.revenue;bandList.push_back(std::move(x));}j["bands"]=Json(std::move(bandList));
  return j;}
 // ---- Trip planner -----------------------------------------------------------------------------
 // Plans charging stops between two points from the Pluggo network and the public station
 // directory. Each leg is checked with the domain RangeSafetyService (15% range buffer); stops
 // are picked greedily as far along the route as the battery safely reaches.
 Json trip(double fromLat,double fromLng,double toLat,double toLng,const std::string& vehicleId,double battery){
  const auto& v=profile(vehicleId);const double capacity=v["capacity"].d(),power=v["power"].d(),kmPerKWh=v.has("kmPerKWh")?v["kmPerKWh"].d():6;
  if(!(battery>=5&&battery<=100))throw ApiError(400,"Battery must be between 5% and 100%");
  constexpr double roadFactor=1.3,buffer=15,arriveAtLeast=10,chargeTo=80,averageSpeed=45,estimateRate=18,unknownPower=7.4;
  const double straight=distanceKm(fromLat,fromLng,toLat,toLng);if(straight<2)throw ApiError(400,"Pick a destination at least 2 km away");if(straight>2500)throw ApiError(400,"That trip is too long to plan");
  auto check=[&](double soc,double km){const ev::Vehicle probe("TRIP",capacity,soc,1.0/kmPerKWh,ev::ConnectorType::CCS2,power);return ev::RangeSafetyService::evaluate(probe,km,buffer);};
  // A charger is useful when it brings you closer to the destination without a big detour. Roads in
  // the hills wind far from the straight line, so there is no fixed corridor around it.
  struct Candidate {double lat,lng,powerKW,toDest;std::string id,name,address,network;};std::vector<Candidate> candidates;
  auto consider=[&](double lat,double lng,double kw,std::string id,std::string name,std::string address,std::string network){
   const double toDest=distanceKm(lat,lng,toLat,toLng);if(toDest>=straight-2)return;
   if(distanceKm(fromLat,fromLng,lat,lng)+toDest>straight*1.6+30)return;
   candidates.push_back({lat,lng,kw,toDest,std::move(id),std::move(name),std::move(address),std::move(network)});};
  for(const auto& e:publicDirectory.entries){const auto& s=publicDirectory.root["stations"][e.index];consider(e.lat,e.lng,s.has("powerKW")&&s["powerKW"].t()==crow::json::type::Number?s["powerKW"].d():0,text(s,"id"),text(s,"name"),text(s,"address"),"public");}
  for(const auto& s:catalog["stations"]){double best=0;for(const auto& c:s["connectors"])if(compatible(v,std::string(c["type"].s())))best=std::max(best,c["power"].d());if(best>0)consider(s["lat"].d(),s["lng"].d(),best,std::string(s["id"].s()),string(s,"name"),string(s,"area"),"pluggo");}
  struct Plan {bool arrived=false;double soc=0,lat=0,lng=0,minutes=0,cost=0;Json::list stops;};
  auto plan=[&](double startSoc){
   Plan p;p.soc=startSoc;p.lat=fromLat;p.lng=fromLng;
   for(int guard=0;guard<15;++guard){
    const double remaining=distanceKm(p.lat,p.lng,toLat,toLng);
    if(check(p.soc,remaining*roadFactor).canReach){p.arrived=true;return p;}
    // Reachable chargers that make real progress. Among those nearly as close to the destination
    // as the best one, take the fastest (a known DC charger beats an unlisted one a little further on).
    std::vector<std::pair<const Candidate*,double>> reachable;double closest=remaining;
    for(const auto& c:candidates){
     if(c.toDest>remaining-5)continue;
     const double leg=distanceKm(p.lat,p.lng,c.lat,c.lng);if(leg+c.toDest>remaining*1.45+15)continue;
     const double km=leg*roadFactor;if(!check(p.soc,km).canReach||p.soc-km/kmPerKWh/capacity*100<arriveAtLeast)continue;
     reachable.emplace_back(&c,km);closest=std::min(closest,c.toDest);}
    const Candidate* pick=nullptr;double pickKm=0,pickKW=0;const double slack=std::max(10.0,remaining*0.05);
    for(const auto& [c,km]:reachable){if(c->toDest>closest+slack)continue;const double kw=std::min(power,c->powerKW>0?c->powerKW:unknownPower);
     if(!pick||kw>pickKW+1e-9||(std::abs(kw-pickKW)<1e-9&&c->toDest<pick->toDest)){pick=c;pickKm=km;pickKW=kw;}}
    if(!pick)return p;
    const double arrive=p.soc-pickKm/kmPerKWh/capacity*100,leave=std::max(chargeTo,arrive),added=(leave-arrive)/100*capacity;
    const double kw=std::max(1.0,pickKW),minutes=added/kw*60;
    Json stop;stop["id"]=pick->id;stop["name"]=pick->name.empty()?"EV charging station":pick->name;stop["address"]=pick->address;stop["network"]=pick->network;stop["lat"]=pick->lat;stop["lng"]=pick->lng;
    stop["legKm"]=pickKm;stop["arriveBattery"]=arrive;stop["leaveBattery"]=leave;stop["energyKWh"]=added;stop["powerKW"]=kw;stop["powerKnown"]=pick->powerKW>0;stop["minutes"]=minutes;stop["costEstimate"]=added*estimateRate;
    p.stops.push_back(std::move(stop));p.minutes+=minutes;p.cost+=added*estimateRate;p.soc=leave;p.lat=pick->lat;p.lng=pick->lng;}
   return p;};
  auto result=plan(battery);double startBattery=battery;bool chargeFirst=false;
  // Too little charge to reach any useful charger: plan again from a full battery and say so.
  if(!result.arrived&&battery<100){auto full=plan(100);if(full.arrived){result=std::move(full);startBattery=100;chargeFirst=true;}}
  std::string note;
  if(chargeFirst)note="Your battery is too low to reach a charger on the way. Charge to 100% before you leave, then follow this plan.";
  else if(!result.arrived)note=result.stops.size()>=15?"This trip needs more stops than we can plan. Split it into shorter trips.":"There are not enough mapped chargers on this route for your vehicle, even from a full battery. Try a nearer destination.";
  const double finalKm=distanceKm(result.lat,result.lng,toLat,toLng)*roadFactor,total=straight*roadFactor;
  Json j;j["ok"]=true;j["feasible"]=result.arrived;j["chargeFirst"]=chargeFirst;j["note"]=note;j["vehicle"]=vehicleId;j["startBattery"]=startBattery;j["requestedBattery"]=battery;
  j["straightKm"]=straight;j["distanceKm"]=total;j["rangeKm"]=capacity*startBattery/100*kmPerKWh;
  j["finalLegKm"]=finalKm;j["arrivalBattery"]=result.arrived?Json(result.soc-finalKm/kmPerKWh/capacity*100):Json(nullptr);j["driveMinutes"]=total/averageSpeed*60;j["chargeMinutes"]=result.minutes;j["chargeCostEstimate"]=result.cost;
  j["stops"]=Json(std::move(result.stops));j["assumptions"]="Road distance is about 1.3 times the straight line at 45 km/h. You charge to 80%, arrive at every stop with at least 10%, and keep a 15% range buffer. Costs use Rs 18/kWh; check each charger's plug type and price.";
  return j;}
 Json simulatorSessions() {lastSimulator=nowMs();advance();Json j;j["ok"]=true;j["mode"]=mode;j["speed"]=speed;Json::list values;for(const auto& s:sessions())if(!s.ended){auto item=s.json();item["external"]=real(s.connector);values.push_back(std::move(item));}j["sessions"]=std::move(values);return j;}
 void meter(const Input& body) {lastSimulator=nowMs();const auto id=string(body,"sessionId");auto rows=query("SELECT id,owner,idem,payload,request FROM customer_sessions WHERE id=?",{id});if(rows.empty())throw ApiError(404,"Session not found");auto s=fromRow(rows[0]);if(mode!="meter"&&!real(s.connector))return;const bool lateFinal=s.ended&&real(s.connector)&&!s.settled&&nowMs()-s.ended<120000&&query("SELECT session FROM customer_payments WHERE session=?",{s.id}).empty();if(s.ended&&!lateFinal)return;if(string(body,"connector")!=s.connector)throw ApiError(409,"Meter connector does not match session");const double energy=number(body,"energyKWh",s.energy);if(energy<0)throw ApiError(400,"Energy must be non-negative");if(body.has("soc")){const double reading=number(body,"soc",-1);if(reading<0||reading>100)throw ApiError(400,"Battery reading must be 0–100%");
   // From the first reading the car decides the target; only the budget still caps energy.
   if(s.carSoc<0)s.limit=s.budget/s.rate;s.carSoc=reading;}
  s.energy=std::min(s.limit,std::max(s.energy,energy));
  if(!s.ended){if(s.carSoc>=s.target){s.ended=nowMs();s.reason="Charge target reached";}else complete(s);}persist(s);}
};
std::shared_ptr<Store> store;
crow::response response(Json j,int status=200){crow::response r(status,j.dump());r.set_header("Content-Type","application/json; charset=utf-8");r.set_header("Cache-Control","no-store");return r;}
crow::response failure(const std::string& message,int status){Json j;j["ok"]=false;j["error"]=message;return response(std::move(j),status);}
Input body(const crow::request& request){if(request.body.size()>16384)throw ApiError(413,"Request is too large");auto value=crow::json::load(request.body);if(!value||value.t()!=crow::json::type::Object)throw ApiError(400,"Invalid JSON object");return value;}
// Runs a store operation in a transaction without a visitor cookie (webhooks and operator tools).
crow::response locked(const std::function<Json()>& operation){std::lock_guard<std::mutex> lock(store->mutex);bool transaction=false;try{store->begin();transaction=true;auto value=operation();store->commit();transaction=false;return response(std::move(value));}catch(const ApiError& e){if(transaction)store->rollback();return failure(e.what(),e.status);}catch(const std::exception& e){if(transaction)store->rollback();std::cerr<<"store: "<<e.what()<<'\n';return failure("Storage error",500);}}
crow::response customer(const crow::request& request,bool bootstrap,const std::function<Json(const std::string&)>& operation){std::lock_guard<std::mutex> lock(store->mutex);bool transaction=false;try{const auto origin=request.get_header_value("Origin"),host=request.get_header_value("Host");if(!origin.empty()&&origin!="http://"+host&&origin!="https://"+host)throw ApiError(403,"Cross-origin request rejected");if(request.method!=crow::HTTPMethod::GET&&request.get_header_value("X-Pluggo-Request")!="1")throw ApiError(403,"Missing application request header");store->begin();transaction=true;bool fresh=false;auto owner=store->visitor(request,bootstrap,fresh);auto value=operation(owner);store->commit();transaction=false;auto r=response(std::move(value));if(fresh)r.set_header("Set-Cookie",cookieFor(owner));return r;}catch(const ApiError& e){if(transaction)store->rollback();Json j;j["ok"]=false;j["error"]=e.what();return response(std::move(j),e.status);}catch(const std::exception& e){if(transaction)store->rollback();std::cerr<<"customer API: "<<e.what()<<'\n';Json j;j["ok"]=false;j["error"]="Backend storage operation failed";return response(std::move(j),500);}}
}
crow::response customerOperatorStation(){std::lock_guard<std::mutex> lock(store->mutex);try{return response(store->operatorStation());}catch(const std::exception& e){Json j;j["ok"]=false;j["error"]="Session overview unavailable";return response(std::move(j),503);}}
// Operator routes (dashboard). When phone sign-in is configured, the caller must send a
// Firebase ID token whose phone number is listed in PLUGGO_OPERATOR_PHONES. With Firebase
// on and no list, nobody is let in: the dashboard is never open by accident.
std::vector<std::string> operatorPhones(){std::vector<std::string> phones;std::string raw=env("PLUGGO_OPERATOR_PHONES",""),item;for(char& c:raw)if(c==','||c==';'||c=='\n'||c=='\r'||c=='\t')c=' ';std::istringstream in(raw);while(in>>item){bool ok=item.size()>=9&&item.size()<=16&&item[0]=='+'&&std::all_of(item.begin()+1,item.end(),[](unsigned char c){return std::isdigit(c);});if(ok)phones.push_back(item);}return phones;}
bool operatorAuthRequired(){return firebase->enabled()||!operatorPhones().empty();}
std::optional<crow::response> operatorCheck(const crow::request& r,std::string& phone){
 if(!operatorAuthRequired()){phone="local-operator";return std::nullopt;}
 if(!firebase->enabled())return failure("Operator sign-in needs PLUGGO_FIREBASE_PROJECT_ID on the server",503);
 const auto header=r.get_header_value("Authorization");
 if(header.rfind("Bearer ",0)!=0||header.size()<20)return failure("Operator sign-in required",401);
 FirebaseUser user;
 try{user=firebase->verify(header.substr(7));}catch(const std::exception&){return failure("Your operator sign-in has expired. Sign in again.",401);}
 const auto phones=operatorPhones();
 if(user.phone.empty()||std::find(phones.begin(),phones.end(),user.phone)==phones.end())return failure("This number is not registered as a Pluggo operator",403);
 if(r.method!=crow::HTTPMethod::GET)CROW_LOG_WARNING<<"operator "<<user.phone<<" "<<crow::method_name(r.method)<<" "<<r.url;
 phone=user.phone;return std::nullopt;
}
std::optional<crow::response> operatorDenied(const crow::request& r){std::string phone;return operatorCheck(r,phone);}
crow::response operatorAuthInfo(const crow::request& r){
 Json j;j["ok"]=true;j["required"]=operatorAuthRequired();
 if(firebase->enabled()){j["firebase"]["projectId"]=firebase->projectId();j["firebase"]["apiKey"]=env("PLUGGO_FIREBASE_API_KEY","");j["firebase"]["authDomain"]=env("PLUGGO_FIREBASE_AUTH_DOMAIN",firebase->projectId()+".firebaseapp.com");j["firebase"]["appId"]=env("PLUGGO_FIREBASE_APP_ID","");}
 auto denied=operatorDenied(r);j["signedIn"]=!denied;
 if(denied){auto parsed=crow::json::load(denied->body);if(parsed&&parsed.has("error"))j["reason"]=std::string(parsed["error"].s());j["status"]=denied->code;}
 return response(std::move(j));
}
crow::response customerReadiness(){std::lock_guard<std::mutex> lock(store->mutex);try{return response(store->health());}catch(...){Json j;j["ok"]=false;j["error"]="Customer storage is unavailable";return response(std::move(j),503);}}
void registerCustomerApi(crow::SimpleApp& app){initIntegrations();publicDirectory.load();
 // Real stations near a point and/or matching a search ("Lajpat Nagar", "Tata Power"). Public, read-only.
 CROW_ROUTE(app,"/api/customer/public-stations")([](const crow::request& r){
  if(publicDirectory.entries.empty())return failure("Real station data is not available on this server",404);
  auto param=[&](const char* key){const char* v=r.url_params.get(key);return v?std::string(v):std::string();};
  std::string q=param("q");if(q.size()>80)return failure("Search is too long",400);
  std::transform(q.begin(),q.end(),q.begin(),[](unsigned char c){return static_cast<char>(std::tolower(c));});
  std::vector<std::string> terms;{std::istringstream in(q);std::string t;while(in>>t)terms.push_back(t);}
  bool located=false;double lat=0,lng=0,radius=25;std::size_t limit=40;
  try{
   if(!param("lat").empty()||!param("lng").empty()){lat=std::stod(param("lat"));lng=std::stod(param("lng"));located=std::isfinite(lat)&&std::isfinite(lng)&&std::abs(lat)<=90&&std::abs(lng)<=180;if(!located)throw std::invalid_argument("location");}
   if(!param("radius").empty())radius=std::stod(param("radius"));
   if(!param("limit").empty())limit=static_cast<std::size_t>(std::stoul(param("limit")));
  }catch(const std::exception&){return failure("Invalid location, radius or limit",400);}
  if(!std::isfinite(radius)||radius<=0)return failure("Invalid radius",400);
  // Up to 300 km around a point: in the hills the nearest charger can be that far.
  radius=std::min(radius,terms.empty()?300.0:1000.0);limit=std::clamp<std::size_t>(limit,1,100);
  if(!located&&terms.empty())return failure("Give a location or a search term",400);
  std::vector<std::pair<double,std::size_t>> found;
  for(const auto& e:publicDirectory.entries){
   if(!std::all_of(terms.begin(),terms.end(),[&](const std::string& t){return e.search.find(t)!=std::string::npos;}))continue;
   const double d=located?distanceKm(lat,lng,e.lat,e.lng):0;if(located&&d>radius)continue;found.emplace_back(d,e.index);}
  std::sort(found.begin(),found.end());const auto total=found.size();if(found.size()>limit)found.resize(limit);
  Json::list stations;for(const auto& [d,i]:found){Json s(publicDirectory.root["stations"][i]);if(located)s["distanceKm"]=std::round(d*10)/10;stations.push_back(std::move(s));}
  Json j;j["ok"]=true;j["total"]=static_cast<std::int64_t>(total);j["stations"]=std::move(stations);
  j["sources"]=Json(publicDirectory.root["sources"]);j["updatedAt"]=std::string(publicDirectory.root["updatedAt"].s());
  auto out=response(std::move(j));out.set_header("Cache-Control","public, max-age=300");return out;});firebase=std::make_unique<FirebaseVerifier>();payments=std::make_unique<Razorpay>();store=std::make_shared<Store>();
 CROW_WEBSOCKET_ROUTE(app,"/ocpp/customer")
  .onaccept([](const crow::request& request,void**){return request.get_header_value("X-Charger-Key")==store->key;})
  .onopen([](crow::websocket::connection&){std::lock_guard<std::mutex> lock(store->mutex);store->lastSimulator=nowMs();})
  .onmessage([](crow::websocket::connection& connection,const std::string& message,bool binary){
   if(binary||message.size()>16384)return;
   try {auto packet=crow::json::load(message);if(!packet||packet.t()!=crow::json::type::List||packet.size()!=4||packet[0].i()!=2)return;const std::string id=packet[1].s(),action=packet[2].s();const auto& payload=packet[3];std::lock_guard<std::mutex> lock(store->mutex);store->lastSimulator=nowMs();Json reply;
    if(action=="TransactionEvent"){store->begin();try{store->meter(payload);store->commit();}catch(...){store->rollback();throw;}}
    else if(action=="TransactionEnded"){store->begin();try{store->transactionEnded(payload);store->commit();}catch(...){store->rollback();throw;}}
    else if(action=="ConnectorStatus")store->connectorStatus(payload);
    else if(action=="BootNotification"){reply["status"]="Accepted";reply["interval"]=5;}
    Json::list frame;frame.emplace_back(3);frame.emplace_back(id);frame.push_back(std::move(reply));connection.send_text(Json(std::move(frame)).dump());
   }catch(const std::exception&){connection.close("Invalid customer simulator message");}
  });
 CROW_ROUTE(app,"/api/customer/bootstrap")([](const crow::request& r){return customer(r,true,[](const std::string& owner){return store->snapshot(owner);});});
 CROW_ROUTE(app,"/api/customer/state")([](const crow::request& r){return customer(r,false,[](const std::string& owner){return store->snapshot(owner);});});
 CROW_ROUTE(app,"/api/customer/preferences").methods(crow::HTTPMethod::PUT)([](const crow::request& r){return customer(r,false,[&](const std::string& owner){store->preferences(owner,body(r));return store->snapshot(owner);});});
 CROW_ROUTE(app,"/api/customer/verify").methods(crow::HTTPMethod::POST)([](const crow::request& r){return customer(r,false,[&](const std::string& owner){return store->verify(owner,body(r));});});
 CROW_ROUTE(app,"/api/customer/sessions").methods(crow::HTTPMethod::POST)([](const crow::request& r){return customer(r,false,[&](const std::string& owner){auto id=store->start(owner,body(r),r.get_header_value("Idempotency-Key"));auto j=store->snapshot(owner);j["sessionId"]=id;return j;});});
 CROW_ROUTE(app,"/api/customer/sessions/<string>/stop").methods(crow::HTTPMethod::POST)([](const crow::request& r,const std::string& id){return customer(r,false,[&](const std::string& owner){store->action(owner,id,false);return store->snapshot(owner);});});
 CROW_ROUTE(app,"/api/customer/sessions/<string>/checkout").methods(crow::HTTPMethod::POST)([](const crow::request& r,const std::string& id){return customer(r,false,[&](const std::string& owner){const auto payment=body(r);store->action(owner,id,true,&payment);return store->snapshot(owner);});});
 // Creates (or reuses) the Razorpay order for an ended session. The provider call runs outside the store lock.
 CROW_ROUTE(app,"/api/customer/sessions/<string>/payment").methods(crow::HTTPMethod::POST)([](const crow::request& r,const std::string& id){
  if(!payments->enabled())return failure("Online payment is not configured",404);
  std::int64_t due=0;std::string order,phoneNumber;bool settled=false;
  auto quote=customer(r,false,[&](const std::string& owner){settled=store->settledSession(owner,id);if(!settled){const auto q=store->paymentQuote(owner,id);due=q.first;order=q.second;}phoneNumber=store->phone(owner);Json j;j["ok"]=true;return j;});
  if(quote.code!=200)return quote;
  if(!settled&&due<100)return failure("No payment is needed for this session",409);
  // The earlier order may already be paid (the app closed before checkout reported back).
  // Ask Razorpay before offering a new payment, so nobody pays twice.
  if(!settled&&!order.empty()){
   try{
    for(const auto& p:payments->orderPayments(order)){
     if(p.amount!=due||(p.status!="captured"&&p.status!="authorized"))continue;
     if(p.status=="authorized")payments->capture(p.id,due);
     auto done=customer(r,false,[&](const std::string&){store->settleFromProvider(order,p.id,due);Json j;j["ok"]=true;return j;});
     if(done.code!=200)return done;
     settled=true;break;
    }
   }catch(const std::exception& e){
    // Lookup failed: reusing the same order is still safe, because Razorpay refuses a second payment on a paid order.
    std::cerr<<"razorpay: order lookup failed, reusing "<<order<<": "<<e.what()<<'\n';
   }
  }
  if(settled)return customer(r,false,[](const std::string& owner){auto j=store->snapshot(owner);j["settled"]=true;return j;});
  if(order.empty()){
   try{order=payments->createOrder(due,id);}catch(const std::exception& e){std::cerr<<"razorpay: "<<e.what()<<'\n';return failure("The payment service is unavailable. Please try again.",502);}
   auto saved=customer(r,false,[&](const std::string& owner){store->recordOrder(owner,id,order,due);Json j;j["ok"]=true;return j;});
   if(saved.code!=200)return saved;
  }
  Json j;j["ok"]=true;j["orderId"]=order;j["amount"]=due;j["currency"]="INR";j["keyId"]=payments->keyId();j["phone"]=phoneNumber;return response(std::move(j));});
 // Razorpay webhooks (Dashboard → Webhooks; secret in RAZORPAY_WEBHOOK_SECRET). order.paid settles
 // the session even if the customer never returns; refund events update refund status.
 CROW_ROUTE(app,"/api/customer/razorpay/webhook").methods(crow::HTTPMethod::POST)([](const crow::request& r){
  if(!payments->webhookEnabled())return failure("Webhooks are not configured",404);
  if(!payments->verifyWebhook(r.body,r.get_header_value("X-Razorpay-Signature")))return failure("Invalid webhook signature",400);
  const auto event=crow::json::load(r.body);
  if(!event||!event.has("event")||event["event"].t()!=crow::json::type::String||!event.has("payload"))return failure("Invalid webhook body",400);
  const std::string name=event["event"].s(),eventId=r.get_header_value("X-Razorpay-Event-Id");
  auto text=[](const crow::json::rvalue& v,const char* key){return v.has(key)&&v[key].t()==crow::json::type::String?std::string(v[key].s()):std::string();};
  return locked([&]{
   Json j;j["ok"]=true;
   if(!eventId.empty()&&store->eventSeen(eventId)){j["duplicate"]=true;return j;}
   const auto& payload=event["payload"];
   if((name=="order.paid"||name=="payment.captured")&&payload.has("payment")&&payload["payment"].has("entity")){
    const auto& p=payload["payment"]["entity"];const auto orderId=text(p,"order_id"),paymentId=text(p,"id");
    if(!orderId.empty()&&!paymentId.empty()&&p.has("amount")&&p["amount"].t()==crow::json::type::Number){
     try{j["settled"]=store->settleFromProvider(orderId,paymentId,p["amount"].i());}
     catch(const ApiError& e){std::cerr<<"razorpay webhook "<<name<<": "<<e.what()<<'\n';j["settled"]=false;}
    }
   }else if(name=="payment.failed"&&payload.has("payment")&&payload["payment"].has("entity")){
    std::cerr<<"razorpay: payment failed for order "<<text(payload["payment"]["entity"],"order_id")<<'\n';
   }else if(name.rfind("refund.",0)==0&&payload.has("refund")&&payload["refund"].has("entity")){
    const auto& f=payload["refund"]["entity"];const auto refundId=text(f,"id"),status=text(f,"status");
    if(!refundId.empty()&&!status.empty())store->refundStatus(refundId,status);
   }
   if(!eventId.empty())store->markEvent(eventId);
   return j;});});
 // Operator refund of a paid session, in full (no amount) or in part. Needs a signed-in operator.
 CROW_ROUTE(app,"/api/operator/refund").methods(crow::HTTPMethod::POST)([](const crow::request& r){
  std::string operatorPhone;if(auto denied=operatorCheck(r,operatorPhone))return std::move(*denied);
  if(!payments->enabled())return failure("Online payment is not configured",404);
  std::string id,reason,paymentId;std::int64_t amount=0;
  try{const auto b=body(r);id=string(b,"sessionId");reason=string(b,"reason","Refund by operator");if(reason.size()>200)reason.resize(200);
   if(b.has("amount")){if(b["amount"].t()!=crow::json::type::Number)throw ApiError(400,"Invalid refund amount");const double rupees=b["amount"].d();if(!std::isfinite(rupees)||rupees<=0)throw ApiError(400,"Invalid refund amount");amount=amountPaise(rupees);}}
  catch(const ApiError& e){return failure(e.what(),e.status);}catch(const std::exception&){return failure("Invalid refund request",400);}
  auto checked=locked([&]{if(amount==0)amount=store->refundTarget(id,1).refundable;paymentId=store->refundTarget(id,amount).paymentId;Json j;j["ok"]=true;return j;});
  if(checked.code!=200)return checked;
  std::string refundId;
  try{refundId=payments->refund(paymentId,amount,reason);}catch(const std::exception& e){std::cerr<<"razorpay: "<<e.what()<<'\n';return failure("Razorpay did not accept the refund. Check the Razorpay dashboard and try again.",502);}
  CROW_LOG_WARNING<<"operator "<<operatorPhone<<" refunded "<<amount<<" paise on "<<id<<" ("<<refundId<<")";
  return locked([&]{store->recordRefund(id,refundId,amount,reason,operatorPhone);Json j;j["ok"]=true;j["refundId"]=refundId;j["amount"]=amount/100.0;j["refunds"]=store->refunds(id);return j;});});
 // Exchanges a Firebase phone-auth ID token for this browser's Pluggo account.
 CROW_ROUTE(app,"/api/customer/auth/firebase").methods(crow::HTTPMethod::POST)([](const crow::request& r){
  if(r.get_header_value("X-Pluggo-Request")!="1")return failure("Missing application request header",403);
  FirebaseUser user;
  try{const auto b=body(r);user=firebase->verify(string(b,"idToken"));}
  catch(const ApiError& e){return failure(e.what(),e.status);}
  catch(const std::exception& e){return failure(e.what(),401);}
  std::string switchTo;
  auto result=customer(r,true,[&](const std::string& owner){switchTo=store->signIn(owner,user);return store->snapshot(switchTo.empty()?owner:switchTo);});
  if(result.code==200&&!switchTo.empty())result.set_header("Set-Cookie",cookieFor(switchTo));
  return result;});
 CROW_ROUTE(app,"/api/customer/auth/logout").methods(crow::HTTPMethod::POST)([](const crow::request& r){
  std::string next;
  auto result=customer(r,false,[&](const std::string&){next=store->newVisitor();return store->snapshot(next);});
  if(result.code==200)result.set_header("Set-Cookie",cookieFor(next));
  return result;});
 CROW_ROUTE(app,"/api/customer/account/delete").methods(crow::HTTPMethod::POST)([](const crow::request& r){
  std::string next;
  auto result=customer(r,false,[&](const std::string& owner){if(owner=="erased")throw ApiError(403,"Not allowed");store->eraseAccount(owner);next=store->newVisitor();auto j=store->snapshot(next);j["deleted"]=true;return j;});
  if(result.code==200)result.set_header("Set-Cookie",cookieFor(next));
  return result;});
 CROW_ROUTE(app,"/api/customer/reset").methods(crow::HTTPMethod::POST)([](const crow::request& r){return customer(r,false,[](const std::string& owner){store->reset(owner);return store->snapshot(owner);});});
 CROW_ROUTE(app,"/api/customer/bookings").methods(crow::HTTPMethod::POST)([](const crow::request& r){return customer(r,false,[&](const std::string& owner){const auto id=store->book(owner,body(r));auto j=store->snapshot(owner);j["bookingId"]=id;return j;});});
 CROW_ROUTE(app,"/api/customer/bookings/<string>/cancel").methods(crow::HTTPMethod::POST)([](const crow::request& r,const std::string& id){return customer(r,false,[&](const std::string& owner){store->cancelBooking(owner,id);return store->snapshot(owner);});});
 CROW_ROUTE(app,"/api/customer/stations/<string>/review").methods(crow::HTTPMethod::POST)([](const crow::request& r,const std::string& id){return customer(r,false,[&](const std::string& owner){store->review(owner,id,body(r));return store->snapshot(owner);});});
 CROW_ROUTE(app,"/api/customer/reports").methods(crow::HTTPMethod::POST)([](const crow::request& r){return customer(r,false,[&](const std::string& owner){const auto id=store->report(owner,body(r));auto j=store->snapshot(owner);j["reportId"]=id;return j;});});
 // Charging stops for a trip. Reads only the station catalog and directory, so it needs no visitor.
 CROW_ROUTE(app,"/api/customer/trip")([](const crow::request& r){
  auto param=[&](const char* key){const char* v=r.url_params.get(key);if(!v)throw ApiError(400,std::string("Missing ")+key);std::size_t used=0;const double n=std::stod(v,&used);if(used!=std::strlen(v)||!std::isfinite(n))throw ApiError(400,std::string("Invalid ")+key);return n;};
  try{
   const double fromLat=param("fromLat"),fromLng=param("fromLng"),toLat=param("toLat"),toLng=param("toLng");
   for(const double lat:{fromLat,toLat})if(std::abs(lat)>90)throw ApiError(400,"Invalid location");for(const double lng:{fromLng,toLng})if(std::abs(lng)>180)throw ApiError(400,"Invalid location");
   const char* vehicle=r.url_params.get("vehicle");const double battery=r.url_params.get("battery")?param("battery"):25;
   return response(store->trip(fromLat,fromLng,toLat,toLng,vehicle?vehicle:"car",battery));
  }catch(const ApiError& e){return failure(e.what(),e.status);}catch(const std::exception&){return failure("Invalid trip request",400);}});
 // Operator analytics, fault reports and wallet credit. Each needs a signed-in operator when sign-in is configured.
 CROW_ROUTE(app,"/api/operator/analytics")([](const crow::request& r){
  if(auto denied=operatorDenied(r))return std::move(*denied);
  int days=14;if(const char* v=r.url_params.get("days")){try{days=std::stoi(v);}catch(...){return failure("Invalid days",400);}}
  if(days<1||days>90)return failure("Days must be 1 to 90",400);
  return locked([&]{return store->analytics(days);});});
 CROW_ROUTE(app,"/api/operator/reports")([](const crow::request& r){if(auto denied=operatorDenied(r))return std::move(*denied);return locked([]{return store->operatorReports();});});
 CROW_ROUTE(app,"/api/operator/reports/<string>/resolve").methods(crow::HTTPMethod::POST)([](const crow::request& r,const std::string& id){
  std::string operatorPhone;if(auto denied=operatorCheck(r,operatorPhone))return std::move(*denied);
  std::int64_t creditPaise=0;std::string resolution;
  try{const auto b=body(r);resolution=string(b,"resolution","Fixed by the operator");if(resolution.size()>300)resolution.resize(300);const double rupees=number(b,"credit",0);if(!(rupees>=0&&rupees<=500))throw ApiError(400,"Credit must be ₹0 to ₹500");creditPaise=amountPaise(rupees);}
  catch(const ApiError& e){return failure(e.what(),e.status);}catch(const std::exception&){return failure("Invalid request",400);}
  return locked([&]{store->resolveReport(id,operatorPhone,creditPaise,resolution);CROW_LOG_WARNING<<"operator "<<operatorPhone<<" resolved "<<id<<" with "<<creditPaise<<" paise credit";return store->operatorReports();});});
 CROW_ROUTE(app,"/api/operator/credit").methods(crow::HTTPMethod::POST)([](const crow::request& r){
  std::string operatorPhone;if(auto denied=operatorCheck(r,operatorPhone))return std::move(*denied);
  std::string sessionId,reason;std::int64_t paise=0;
  try{const auto b=body(r);sessionId=string(b,"sessionId");reason=string(b,"reason","Credit from Pluggo");if(reason.size()>200)reason.resize(200);const double rupees=number(b,"amount",0);if(!(rupees>=1&&rupees<=500))throw ApiError(400,"Credit must be ₹1 to ₹500");paise=amountPaise(rupees);}
  catch(const ApiError& e){return failure(e.what(),e.status);}catch(const std::exception&){return failure("Invalid request",400);}
  return locked([&]{store->creditForSession(sessionId,paise,reason);CROW_LOG_WARNING<<"operator "<<operatorPhone<<" credited "<<paise<<" paise for "<<sessionId;Json j;j["ok"]=true;j["amount"]=paise/100.0;return j;});});
 CROW_ROUTE(app,"/api/customer/simulator/active")([](const crow::request& r){if(r.get_header_value("X-Charger-Key")!=store->key){Json j;j["ok"]=false;j["error"]="Invalid simulator key";return response(std::move(j),401);}std::lock_guard<std::mutex> lock(store->mutex);return response(store->simulatorSessions());});
 CROW_ROUTE(app,"/api/customer/simulator/meter").methods(crow::HTTPMethod::POST)([](const crow::request& r){if(r.get_header_value("X-Charger-Key")!=store->key){Json j;j["ok"]=false;j["error"]="Invalid simulator key";return response(std::move(j),401);}std::lock_guard<std::mutex> lock(store->mutex);try{store->begin();store->meter(body(r));store->commit();Json j;j["ok"]=true;return response(std::move(j));}catch(const std::exception& e){store->rollback();Json j;j["ok"]=false;j["error"]=e.what();return response(std::move(j),400);}});
}
}
