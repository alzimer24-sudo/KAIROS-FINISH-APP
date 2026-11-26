package it.kairos.start;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
 private WebView web;
 private final ExecutorService io = Executors.newSingleThreadExecutor();
 private volatile boolean statusPending = false;

 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  web = new WebView(this);
  web.getSettings().setJavaScriptEnabled(true);
  web.getSettings().setDomStorageEnabled(true);
  web.getSettings().setAllowFileAccessFromFileURLs(false);
  web.getSettings().setAllowUniversalAccessFromFileURLs(false);
  web.addJavascriptInterface(new StartBridge(), "KairosStart");
  web.setWebViewClient(new WebViewClient() {
   @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
    return !url.startsWith("file:///android_asset/");
   }
   @Override public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
    return !request.getUrl().toString().startsWith("file:///android_asset/");
   }
  });
  setContentView(web);
  web.loadUrl("file:///android_asset/index.html");
 }

 private void js(String fn, String value) {
  runOnUiThread(() -> {
   if(web != null) web.evaluateJavascript("window." + fn + "(" + JSONObject.quote(value) + ")", null);
  });
 }

 public class StartBridge {
  @JavascriptInterface public void request(String action, String bib, String nonce) {
   if(!action.equals("status") && !action.equals("lookup") && !action.equals("confirm")) return;
   if(action.equals("status")) {
    if(statusPending) return;
    statusPending = true;
   }
   io.execute(() -> {
    HttpURLConnection connection = null;
    try {
     URL url = new URL("http://192.168.4.1/api/" + action);
     ConnectivityManager cm = (ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);
     Network wifi = null;
     if(cm != null) for(Network network : cm.getAllNetworks()) {
      NetworkCapabilities caps = cm.getNetworkCapabilities(network);
      if(caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) { wifi = network; break; }
     }
     connection = (HttpURLConnection)(wifi == null ? url.openConnection() : wifi.openConnection(url));
     connection.setConnectTimeout(1500);
     connection.setReadTimeout(1500);
     connection.setUseCaches(false);
     if(!action.equals("status")) {
      connection.setRequestMethod("POST");
      connection.setDoOutput(true);
      connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
      String payload = "bib=" + URLEncoder.encode(bib, "UTF-8") +
        "&nonce=" + URLEncoder.encode(nonce, "UTF-8");
      try(OutputStream output = connection.getOutputStream()) {
       output.write(payload.getBytes(StandardCharsets.UTF_8));
      }
     }
     int http = connection.getResponseCode();
     if(http != 200) throw new Exception("HTTP " + http + " dalla Heltec");
     StringBuilder data = new StringBuilder();
     try(BufferedReader reader = new BufferedReader(
          new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
      String line;
      while((line = reader.readLine()) != null) {
       data.append(line);
       if(data.length() > 2048) throw new Exception("Risposta troppo grande");
      }
     }
     JSONObject json = new JSONObject(data.toString());
     if(!json.has("ready")) throw new Exception("Protocollo Heltec non compatibile");
     js("KAIROS_ONDATA", data.toString());
    } catch(Exception e) {
     js("KAIROS_ONERROR", e.getMessage() == null ? "Collegamento non disponibile" : e.getMessage());
    } finally {
     if(connection != null) connection.disconnect();
     if(action.equals("status")) statusPending = false;
    }
   });
  }
 }

 @Override protected void onDestroy() {
  io.shutdownNow();
  if(web != null) { web.destroy(); web = null; }
  super.onDestroy();
 }
}
