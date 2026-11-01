import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  ApiClient(String baseUrl) : dio = Dio(BaseOptions(baseUrl: baseUrl));
  final Dio dio;
  final storage = const FlutterSecureStorage();
  Future<void> initialize() async => dio.interceptors.add(InterceptorsWrapper(onRequest: (o,h) async { final t=await storage.read(key:'access_token'); if(t!=null)o.headers['Authorization']='Bearer $t'; h.next(o); }));
  Future<List<dynamic>> stations() async => (await dio.get('/api/v1/stations')).data['items'];
  Future<Map<String,dynamic>> charger(String id) async => Map<String,dynamic>.from((await dio.get('/api/chargers/$id')).data);
  Future<Map<String,dynamic>> startSession(Map<String,dynamic> body,String key) async => Map<String,dynamic>.from((await dio.post('/api/v1/sessions',data:body,options:Options(headers:{'Idempotency-Key':key}))).data);
  Future<Map<String,dynamic>> session(String id) async => Map<String,dynamic>.from((await dio.get('/api/v1/sessions/$id')).data);
}
