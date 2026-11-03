package com.noutlife.app;

import android.os.Bundle;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoogleSignInPlugin.class);
        super.onCreate(savedInstanceState);
        // Mientras carga la web: el fondo de su splash, no el blanco del WebView.
        getBridge().getWebView().setBackgroundColor(ContextCompat.getColor(this, R.color.splash_background));
    }
}
