package com.pluggo.preview;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.widget.EditText;
import androidx.webkit.WebViewAssetLoader;

/** Android test shell for the exact repository frontend. No JavaScript/native bridge. */
public class MainActivity extends Activity {
    private static final String LOCAL = "https://appassets.androidplatform.net/index.html?demo=1#home";
    private WebView web;
    private String startUrl;
    private GeolocationPermissions.Callback locationCallback;
    private String locationOrigin;
    private PermissionRequest cameraRequest;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        startUrl = withPerformanceProfile(getPreferences(MODE_PRIVATE).getString("startUrl", LOCAL));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(11,11,11));
        web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        setContentView(web);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri target = request.getUrl();
                if (sameOrigin(target, Uri.parse(startUrl))) return false;
                if ("https".equals(target.getScheme()) || "http".equals(target.getScheme())) {
                    try {startActivity(new Intent(Intent.ACTION_VIEW, target));} catch (Exception ignored) { }
                }
                return true;
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                startUrl=Uri.parse(startUrl).buildUpon().clearQuery().encodedQuery(posterQuery(startUrl)).build().toString();
                getPreferences(MODE_PRIVATE).edit().putString("startUrl",startUrl).apply();
                ((android.view.ViewGroup)view.getParent()).removeView(view);
                view.destroy();web=null;
                new AlertDialog.Builder(MainActivity.this).setTitle("Lighter preview ready")
                    .setMessage("The web renderer stopped. Reload with still vehicle previews to use less memory. Saved charging data is kept.")
                    .setPositiveButton("Reload",(d,w)->recreate()).setNegativeButton("Close",(d,w)->finish()).show();
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Cannot reach Pluggo")
                    .setMessage("Check your connection and server address. On a phone, localhost refers to the phone itself. Use the computer's Wi-Fi address or a hosted HTTPS URL.")
                    .setPositiveButton("Retry", (d,w) -> web.reload())
                    .setNegativeButton("Connection", (d,w) -> connection()).show();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!sameOrigin(Uri.parse(origin), Uri.parse(startUrl))) {callback.invoke(origin,false,false);return;}
                if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED) {callback.invoke(origin,true,false);return;}
                if(locationCallback!=null) locationCallback.invoke(locationOrigin,false,false);
                locationCallback=callback;locationOrigin=origin;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},10);
            }
            @Override public void onGeolocationPermissionsHidePrompt() {locationCallback=null;locationOrigin=null;}
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean video=false;
                    for(String resource:request.getResources()) if(PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) video=true;
                    if(!video || !sameOrigin(request.getOrigin(),Uri.parse(startUrl))) {request.deny();return;}
                    if(checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED) {request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});return;}
                    if(cameraRequest!=null) cameraRequest.deny();
                    cameraRequest=request;requestPermissions(new String[]{Manifest.permission.CAMERA},11);
                });
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {if(cameraRequest==request)cameraRequest=null;}
        });
        if(state==null || !restoreWebState(state)) web.loadUrl(startUrl);
    }
    private String withPerformanceProfile(String value) {
        Uri uri=Uri.parse(value);
        if(uri.getQueryParameter("performance")!=null)return value;
        return uri.buildUpon().appendQueryParameter("performance","lite").build().toString();
    }
    private String posterQuery(String value) {
        Uri uri=Uri.parse(value);Uri.Builder builder=uri.buildUpon().clearQuery();
        for(String key:uri.getQueryParameterNames()) if(!key.equals("performance"))
            for(String v:uri.getQueryParameters(key))builder.appendQueryParameter(key,v);
        return builder.appendQueryParameter("performance","poster").build().getEncodedQuery();
    }
    private void memoryPressure() {
        if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('pluggo:memorypressure'))",null);
    }
    @Override public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        if(level==TRIM_MEMORY_RUNNING_LOW || level==TRIM_MEMORY_RUNNING_CRITICAL || level>=TRIM_MEMORY_BACKGROUND)memoryPressure();
    }
    @Override public void onLowMemory() {super.onLowMemory();memoryPressure();}
    private boolean restoreWebState(Bundle state) {return web.restoreState(state)!=null;}
    private static boolean sameOrigin(Uri a,Uri b) {
        return a.getScheme()!=null && a.getScheme().equals(b.getScheme()) && a.getHost()!=null && a.getHost().equals(b.getHost()) && a.getPort()==b.getPort();
    }
    private void load(String url) {
        startUrl=withPerformanceProfile(url);getPreferences(MODE_PRIVATE).edit().putString("startUrl",startUrl).apply();web.loadUrl(startUrl);web.clearHistory();
    }
    private void connection() {
        EditText address = new EditText(this);
        address.setSingleLine(true);
        address.setHint("https://your-pluggo-site.example");
        address.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        String previous=getPreferences(MODE_PRIVATE).getString("serverUrl","");
        address.setText(previous);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Connect Pluggo")
            .setMessage("Enter your hosted app URL or the computer's Wi-Fi address. Offline preview uses simulated data stored on this phone.")
            .setView(address).setPositiveButton("Connect",null)
            .setNeutralButton("Offline preview",(d,w)->load(LOCAL))
            .setNegativeButton("Cancel",null).create();
        dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String value=address.getText().toString().trim();
            Uri uri=Uri.parse(value);
            if(uri.getHost()==null || !("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) || uri.getUserInfo()!=null) {address.setError("Enter a full http:// or https:// app URL");return;}
            getPreferences(MODE_PRIVATE).edit().putString("serverUrl",value).apply();
            dialog.dismiss();load(value);
        }));dialog.show();
    }
    @Override public void onBackPressed() {
        if(web!=null && web.canGoBack()) web.goBack();
        else new AlertDialog.Builder(this).setTitle("Pluggo").setItems(new String[]{"Connection settings","Reload app","Close"},(d,which)->{
            if(which==0)connection();else if(which==1)web.reload();else finish();
        }).show();
    }
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results) {
        super.onRequestPermissionsResult(code,permissions,results);
        if(code==10 && locationCallback!=null) {
            boolean granted=false;for(int result:results)granted|=result==PackageManager.PERMISSION_GRANTED;
            locationCallback.invoke(locationOrigin,granted,false);locationCallback=null;locationOrigin=null;
        }
        if(code==11 && cameraRequest!=null) {
            if(results.length>0 && results[0]==PackageManager.PERMISSION_GRANTED)cameraRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else cameraRequest.deny();
            cameraRequest=null;
        }
    }
    @Override protected void onSaveInstanceState(Bundle out) {super.onSaveInstanceState(out);if(web!=null)web.saveState(out);}
    @Override protected void onPause() {CookieManager.getInstance().flush();if(web!=null){web.onPause();web.pauseTimers();}super.onPause();}
    @Override protected void onResume() {super.onResume();if(web!=null){web.resumeTimers();web.onResume();}}
    @Override protected void onDestroy() {if(cameraRequest!=null)cameraRequest.deny();if(locationCallback!=null)locationCallback.invoke(locationOrigin,false,false);if(web!=null)web.destroy();super.onDestroy();}
}
