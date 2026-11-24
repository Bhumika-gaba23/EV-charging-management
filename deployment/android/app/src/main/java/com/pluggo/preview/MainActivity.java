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
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.util.Collections;

/**
 * Android test shell for the exact repository frontend. The only native bridge is PluggoNative,
 * for charging alerts, and it is injected only into pages from the app's own origin.
 */
public class MainActivity extends Activity {
    private static final String HOSTED = "https://pluggo-customer-demo.onrender.com/#home";
    private static final String LOCAL = "https://appassets.androidplatform.net/index.html?demo=1#home";
    private static final String EXTRA_POSTER = "pluggo.poster";
    private WebView web;
    private String startUrl;
    private GeolocationPermissions.Callback locationCallback;
    private String locationOrigin;
    private PermissionRequest cameraRequest;
    private JavaScriptReplyProxy permissionReply;
    private Boolean permissionAnswer;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        String savedUrl = getPreferences(MODE_PRIVATE).getString("startUrl", HOSTED);
        // Earlier test builds defaulted to offline; switch that default once on upgrade.
        if (getPreferences(MODE_PRIVATE).getInt("hostedDefaultVersion", 0) < 7) {
            if ("appassets.androidplatform.net".equals(Uri.parse(savedUrl).getHost())) savedUrl = HOSTED;
            getPreferences(MODE_PRIVATE).edit().putInt("hostedDefaultVersion", 7).apply();
        }
        // The rendering mode is never stored: builds up to 1.6 saved "performance=poster" after any
        // renderer loss, which left 3D vehicles replaced by still pictures on every later launch.
        savedUrl = withoutPerformance(savedUrl);
        getPreferences(MODE_PRIVATE).edit().putString("startUrl", savedUrl).apply();
        startUrl = withPerformance(savedUrl, getIntent().getBooleanExtra(EXTRA_POSTER, false) ? "poster" : "lite");
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
                ((android.view.ViewGroup)view.getParent()).removeView(view);
                view.destroy();web=null;
                if (!detail.didCrash()) {
                    // The system reclaimed the renderer for memory (common in the background on
                    // ColorOS/MIUI). Nothing is wrong with 3D, so reload as it was.
                    getIntent().removeExtra(EXTRA_POSTER);
                    recreate();
                    return true;
                }
                new AlertDialog.Builder(MainActivity.this).setTitle("Pluggo stopped")
                    .setMessage("The web renderer crashed. Reload with still vehicle pictures for this session to use less memory. Saved charging data is kept.")
                    .setPositiveButton("Reload",(d,w)->{getIntent().putExtra(EXTRA_POSTER,true);recreate();})
                    .setNegativeButton("Close",(d,w)->finish()).show();
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
        Alerts.createChannel(this);
        installAlertBridge();
        if(state==null || !restoreWebState(state)) web.loadUrl(startUrl);
    }
    // Charging alerts: the page posts {type: notify | schedule | cancel | permission} messages.
    private void installAlertBridge() {
        if (web == null || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        try { WebViewCompat.removeWebMessageListener(web, "PluggoNative"); } catch (Exception ignored) { }
        Uri start = Uri.parse(startUrl);
        String origin = start.getScheme() + "://" + start.getHost() + (start.getPort() == -1 ? "" : ":" + start.getPort());
        WebViewCompat.addWebMessageListener(web, "PluggoNative", Collections.singleton(origin), (view, message, source, mainFrame, reply) -> {
            if (!mainFrame || message.getData() == null) return;
            if (!Alerts.handle(this, message.getData())) requestAlertPermission(reply);
        });
    }
    private void requestAlertPermission(JavaScriptReplyProxy reply) {
        if (Alerts.permitted(this)) { reply.postMessage("{\"type\":\"permission\",\"granted\":true}"); return; }
        permissionReply = reply;
        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 12);
    }
    private static String withoutPerformance(String value) {
        Uri uri=Uri.parse(value);Uri.Builder builder=uri.buildUpon().clearQuery();
        for(String key:uri.getQueryParameterNames()) if(!key.equals("performance"))
            for(String v:uri.getQueryParameters(key))builder.appendQueryParameter(key,v);
        return builder.build().toString();
    }
    private static String withPerformance(String value,String profile) {
        return Uri.parse(withoutPerformance(value)).buildUpon().appendQueryParameter("performance",profile).build().toString();
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
        getIntent().removeExtra(EXTRA_POSTER);
        getPreferences(MODE_PRIVATE).edit().putString("startUrl",withoutPerformance(url)).apply();
        startUrl=withPerformance(url,"lite");installAlertBridge();web.loadUrl(startUrl);web.clearHistory();
    }
    private void connection() {
        EditText address = new EditText(this);
        address.setSingleLine(true);
        address.setHint(HOSTED);
        address.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        String previous=getPreferences(MODE_PRIVATE).getString("serverUrl",HOSTED);
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
        // The answer arrives while the page is still paused behind the system dialog, and a
        // message posted then is lost. onResume delivers it once the page runs again.
        if(code==12 && permissionReply!=null) permissionAnswer=results.length>0 && results[0]==PackageManager.PERMISSION_GRANTED;
    }
    @Override protected void onSaveInstanceState(Bundle out) {super.onSaveInstanceState(out);if(web!=null)web.saveState(out);}
    @Override protected void onPause() {CookieManager.getInstance().flush();if(web!=null){web.onPause();web.pauseTimers();}super.onPause();}
    @Override protected void onResume() {
        super.onResume();if(web!=null){web.resumeTimers();web.onResume();}
        if(permissionReply!=null && permissionAnswer!=null) {
            JavaScriptReplyProxy reply=permissionReply;boolean granted=permissionAnswer;permissionReply=null;permissionAnswer=null;
            if(web!=null)web.postDelayed(()->reply.postMessage("{\"type\":\"permission\",\"granted\":"+granted+"}"),300);
        }
    }
    @Override protected void onDestroy() {if(cameraRequest!=null)cameraRequest.deny();if(locationCallback!=null)locationCallback.invoke(locationOrigin,false,false);if(web!=null)web.destroy();super.onDestroy();}
}
