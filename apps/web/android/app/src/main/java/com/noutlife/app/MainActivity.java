package com.noutlife.app;

import android.os.Bundle;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.util.Arrays;
import java.util.Comparator;

public class MainActivity extends BridgeActivity {

    /** Con más que esto en la caché de actualizaciones se recorta, hasta dejar OTA_CACHE_KEEP_BYTES. */
    private static final long OTA_CACHE_MAX_BYTES = 40L * 1024 * 1024;
    private static final long OTA_CACHE_KEEP_BYTES = 20L * 1024 * 1024;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoogleSignInPlugin.class);
        registerPlugin(OtaPendingPlugin.class);
        OtaPendingPlugin.applyPending(this);
        super.onCreate(savedInstanceState);
        // Mientras carga la web: el fondo de su splash, no el blanco del WebView.
        getBridge().getWebView().setBackgroundColor(ContextCompat.getColor(this, R.color.splash_background));
        new Thread(this::trimOtaCache).start();
    }

    /**
     * El plugin de actualizaciones guarda cada archivo que baja para no bajarlo otra vez (src/lib/ota.ts), y solo
     * limpia esa carpeta con un APK nuevo: sin esto crecería con cada despliegue. Borrar de más solo cuesta volver
     * a bajar un archivo.
     */
    private void trimOtaCache() {
        File[] files = new File(getCacheDir(), "capgo_downloads").listFiles();
        if (files == null) return;
        long total = 0;
        for (File file : files) total += file.length();
        if (total <= OTA_CACHE_MAX_BYTES) return;
        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        for (File file : files) {
            if (total <= OTA_CACHE_KEEP_BYTES) break;
            long size = file.length();
            if (file.delete()) total -= size;
        }
    }
}
