package com.florskainan.app;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

/** Small native client for the shared cloud application; no backend keys here. */
public final class MainActivity extends Activity {
    private static final String HOME = "https://flors-kainan.onrender.com/";
    private static final int FILE_PICKER = 41;
    private WebView web;
    private LinearLayout offline;
    private ProgressBar progress;
    private ValueCallback<Uri[]> pendingFiles;

    private boolean trusted(Uri uri) {
        return uri != null && "https".equalsIgnoreCase(uri.getScheme()) &&
            "flors-kainan.onrender.com".equalsIgnoreCase(uri.getHost()) &&
            (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null;
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(247,248,244));
        root.setOnApplyWindowInsetsListener((view,insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left,bars.top,bars.right,bars.bottom);
            } else view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        web = new WebView(this);
        root.addView(web,new FrameLayout.LayoutParams(-1,-1));
        progress = new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);
        FrameLayout.LayoutParams bar = new FrameLayout.LayoutParams(-1,8,Gravity.TOP);
        root.addView(progress,bar);
        offline = new LinearLayout(this); offline.setOrientation(LinearLayout.VERTICAL);
        offline.setGravity(Gravity.CENTER);offline.setPadding(32,32,32,32);
        offline.setBackgroundColor(Color.rgb(247,248,244));
        TextView message = new TextView(this); message.setText(R.string.offline_message);
        message.setGravity(Gravity.CENTER);message.setTextSize(18);message.setTextColor(Color.rgb(40,84,65));
        offline.addView(message);
        Button retry = new Button(this);retry.setText(R.string.retry);retry.setOnClickListener(v -> web.loadUrl(HOME));offline.addView(retry);
        root.addView(offline,new FrameLayout.LayoutParams(-1,-1));offline.setVisibility(View.GONE);
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
                Uri uri=request.getUrl(); if(trusted(uri))return false;
                if(request.isForMainFrame() && ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()) || "mailto".equalsIgnoreCase(uri.getScheme()) || "tel".equalsIgnoreCase(uri.getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW,uri)); } catch(ActivityNotFoundException ignored) {}
                }
                return true;
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon) { offline.setVisibility(View.GONE);progress.setVisibility(View.VISIBLE); }
            @Override public void onPageFinished(WebView view,String url) { progress.setVisibility(View.GONE);CookieManager.getInstance().flush(); }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error) { if(request.isForMainFrame()){offline.setVisibility(View.VISIBLE);progress.setVisibility(View.GONE);} }
            @Override public void onReceivedSslError(WebView view,android.webkit.SslErrorHandler handler,android.net.http.SslError error) { handler.cancel();offline.setVisibility(View.VISIBLE); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view,int value) { progress.setProgress(value); }
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params) {
                if(pendingFiles!=null) pendingFiles.onReceiveValue(null);
                pendingFiles=callback;
                Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);pick.addCategory(Intent.CATEGORY_OPENABLE);pick.setType("image/*");
                pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(pick,FILE_PICKER); } catch(ActivityNotFoundException e) { pendingFiles.onReceiveValue(null);pendingFiles=null; }
                return true;
            }
        });
        web.setDownloadListener((url,userAgent,disposition,mime,length) -> {
            Uri uri=Uri.parse(url);if(!trusted(uri))return;
            DownloadManager.Request download=new DownloadManager.Request(uri);
            String cookie=CookieManager.getInstance().getCookie(url);if(cookie!=null)download.addRequestHeader("Cookie",cookie);
            download.addRequestHeader("User-Agent",userAgent);
            download.setMimeType(mime);download.setTitle(URLUtil.guessFileName(url,disposition,mime));
            download.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            download.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,URLUtil.guessFileName(url,disposition,mime));
            try { ((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(download);Toast.makeText(this,"Saving to Downloads",Toast.LENGTH_SHORT).show(); } catch(RuntimeException e) { Toast.makeText(this,"Could not save the file. Please try again.",Toast.LENGTH_LONG).show(); }
        });
        if(Build.VERSION.SDK_INT>=33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->navigateBack());
        Uri deepLink=getIntent().getData();
        if(state==null || web.restoreState(state)==null) web.loadUrl(trusted(deepLink)?deepLink.toString():HOME);
    }
    private void navigateBack() { if(web.canGoBack())web.goBack();else finish(); }
    // API 33+ uses the native OnBackInvokedDispatcher registered above. This
    // override is only the compatibility fallback for Android 10–12.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @SuppressWarnings("deprecation") @Override public void onBackPressed() { navigateBack(); }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent);setIntent(intent);if(trusted(intent.getData()))web.loadUrl(intent.getData().toString()); }
    @Override protected void onSaveInstanceState(Bundle out) { web.saveState(out);super.onSaveInstanceState(out); }
    @Override protected void onPause() { CookieManager.getInstance().flush();web.onPause();super.onPause(); }
    @Override protected void onResume() { super.onResume();if(web!=null)web.onResume(); }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request==FILE_PICKER && pendingFiles!=null) {
            Uri[] files=null;
            if(result==RESULT_OK && data!=null) {
                if(data.getClipData()!=null) { files=new Uri[data.getClipData().getItemCount()];for(int i=0;i<files.length;i++)files[i]=data.getClipData().getItemAt(i).getUri(); }
                else if(data.getData()!=null)files=new Uri[]{data.getData()};
            }
            if(files!=null)for(Uri uri:files)if(!"content".equalsIgnoreCase(uri.getScheme())){files=null;break;}
            pendingFiles.onReceiveValue(files);pendingFiles=null;
        }
    }
    @Override protected void onDestroy() { if(pendingFiles!=null)pendingFiles.onReceiveValue(null);web.destroy();super.onDestroy(); }
}
