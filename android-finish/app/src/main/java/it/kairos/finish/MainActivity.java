package it.kairos.finish;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.net.Uri;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class MainActivity extends Activity {
  private WebView web;
  private static final int PICK_CSV = 10;
  private static final int SAVE_CSV = 11;
  private ValueCallback<Uri[]> chooserCallback;
  private String pendingCsv;
  private final ExecutorService io = Executors.newSingleThreadExecutor();
  private final AtomicBoolean fetching = new AtomicBoolean(false);

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    web = new WebView(this);
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.getSettings().setAllowFileAccess(true);
    web.getSettings().setAllowFileAccessFromFileURLs(false);
    web.getSettings().setAllowUniversalAccessFromFileURLs(false);
    web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    web.addJavascriptInterface(new HeltecBridge(), "AndroidHeltec");
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
        return !url.startsWith("file:///android_asset/");
      }
      @Override public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest req) {
        return !req.getUrl().toString().startsWith("file:///android_asset/");
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
        if (chooserCallback != null) chooserCallback.onReceiveValue(null);
        chooserCallback = callback;
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("*/*");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(Intent.createChooser(intent, "Importa concorrenti CSV"), PICK_CSV);
        return true;
      }
    });
    setContentView(web);
    web.loadUrl("file:///android_asset/index.html");
  }

  private void sendJs(String function, String arg) {
    runOnUiThread(() -> {
      if(web != null) web.evaluateJavascript("window." + function + "(" + JSONObject.quote(arg) + ")", null);
    });
  }

  public class HeltecBridge {
    @JavascriptInterface public void requestTempo() {
      if (!fetching.compareAndSet(false, true)) return;
      io.submit(() -> {
        HttpURLConnection con = null;
        try {
          URL url = new URL("http://192.168.4.1/api/tempo");
          ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
          Network wifi = null;
          if(cm != null) for(Network net : cm.getAllNetworks()) {
            NetworkCapabilities cap = cm.getNetworkCapabilities(net);
            if(cap != null && cap.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) { wifi=net; break; }
          }
          con = (HttpURLConnection) (wifi == null ? url.openConnection() : wifi.openConnection(url));
          con.setConnectTimeout(1400);
          con.setReadTimeout(1400);
          con.setUseCaches(false);
          if(con.getResponseCode() != 200) throw new Exception("HTTP " + con.getResponseCode());
          StringBuilder content = new StringBuilder();
          try(BufferedReader reader=new BufferedReader(new InputStreamReader(con.getInputStream(),StandardCharsets.UTF_8))) {
            for(String line; (line=reader.readLine()) != null;) {
              content.append(line);
              if(content.length()>512) throw new Exception("Risposta eccessiva");
            }
          }
          JSONObject json = new JSONObject(content.toString());
          if(!json.has("state") || !json.has("us")) throw new Exception("Formato inatteso");
          sendJs("KAIROS_HELTEC_ONDATA",content.toString());
        } catch(Exception e) {
          sendJs("KAIROS_HELTEC_ONERROR","Nessuna risposta dalla Heltec FINISH");
        } finally {
          if(con != null) con.disconnect();
          fetching.set(false);
        }
      });
    }
    @JavascriptInterface public void requestControl(String endpoint, String body) {
      if (!endpoint.equals("lookup") && !endpoint.equals("training") && !endpoint.equals("training/permit") && !endpoint.equals("classifica")) return;
      io.submit(() -> {
        HttpURLConnection con = null;
        try {
          URL url = new URL("http://192.168.4.1/api/" + endpoint);
          ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
          Network wifi = null;
          if(cm != null) for(Network net : cm.getAllNetworks()) {
            NetworkCapabilities cap = cm.getNetworkCapabilities(net);
            if(cap != null && cap.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) { wifi=net; break; }
          }
          if(wifi==null) throw new Exception("Wi-Fi assente");
          con=(HttpURLConnection)wifi.openConnection(url);
          con.setConnectTimeout(1400); con.setReadTimeout(1400); con.setUseCaches(false);
          if(!body.isEmpty()){
            con.setRequestMethod("POST"); con.setDoOutput(true);
            con.setRequestProperty("Content-Type","application/x-www-form-urlencoded");
            try(OutputStream out=con.getOutputStream()){out.write(body.getBytes(StandardCharsets.UTF_8));}
          }
          int status=con.getResponseCode();
          StringBuilder data=new StringBuilder();
          if(status==200) try(BufferedReader reader=new BufferedReader(new InputStreamReader(con.getInputStream(),StandardCharsets.UTF_8))){
            for(String line;(line=reader.readLine())!=null;){data.append(line);if(data.length()>40000)throw new Exception("Risposta eccessiva");}
          }
          JSONObject result=new JSONObject();result.put("endpoint",endpoint);result.put("post",!body.isEmpty());result.put("status",status);result.put("data",data.toString());
          sendJs("KAIROS_CONTROL",result.toString());
        }catch(Exception e){
          try{JSONObject result=new JSONObject();result.put("endpoint",endpoint);result.put("post",!body.isEmpty());result.put("status",0);sendJs("KAIROS_CONTROL",result.toString());}catch(Exception ignored){}
        }finally{if(con!=null)con.disconnect();}
      });
    }
    @JavascriptInterface public void exportCsv(String filename,String content) {
      runOnUiThread(() -> {
        pendingCsv=content;
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("text/csv");
        intent.putExtra(Intent.EXTRA_TITLE,filename.replaceAll("[^a-zA-Z0-9._-]","_"));
        startActivityForResult(intent,SAVE_CSV);
      });
    }
  }

  @Override protected void onActivityResult(int requestCode,int resultCode,Intent data) {
    super.onActivityResult(requestCode,resultCode,data);
    if(requestCode==PICK_CSV && chooserCallback!=null) {
      chooserCallback.onReceiveValue(resultCode==RESULT_OK && data!=null && data.getData()!=null ? new Uri[]{data.getData()} : null);
      chooserCallback=null;
    }
    if(requestCode==SAVE_CSV && resultCode==RESULT_OK && data!=null && data.getData()!=null && pendingCsv!=null) {
      try(OutputStream out=getContentResolver().openOutputStream(data.getData())) {
        if(out!=null) out.write(pendingCsv.getBytes(StandardCharsets.UTF_8));
      } catch(Exception ignored) {}
      pendingCsv=null;
    }
  }
  @Override public void onBackPressed() {
    if(web!=null && web.canGoBack()) web.goBack(); else super.onBackPressed();
  }
  @Override protected void onDestroy() {
    io.shutdownNow();
    if(web!=null) web.destroy();
    super.onDestroy();
  }
}
