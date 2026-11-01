import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthService {
  static const issuer='http://10.0.2.2:8080/realms/chargeflow';
  static const clientId='chargeflow-mobile';
  static const redirect='com.chargeflow.app:/oauthredirect';
  final _auth=const FlutterAppAuth(); final _storage=const FlutterSecureStorage();
  Future<bool> login() async { final r=await _auth.authorizeAndExchangeCode(const AuthorizationTokenRequest(clientId,redirect,discoveryUrl:'$issuer/.well-known/openid-configuration',scopes:['openid','profile','email','offline_access'])); if(r?.accessToken==null)return false; await _storage.write(key:'access_token',value:r!.accessToken); await _storage.write(key:'refresh_token',value:r.refreshToken); return true; }
  Future<void> logout()=>_storage.deleteAll();
}
