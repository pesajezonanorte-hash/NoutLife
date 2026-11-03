package com.noutlife.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.plugin.WebView;
import java.io.File;

/**
 * La versión de la web ya descargada que entra en la próxima apertura (src/lib/ota.ts). La aplica MainActivity
 * antes de crear el WebView: hacerlo desde la página, con set() del plugin, choca con la doble carga de Capacitor
 * al arrancar con una versión descargada (Bridge.loadWebView). Chromium descarta la recarga por duplicada o el
 * plugin ignora notifyAppReady, y una versión sana volvía atrás a los 30 s en una de cada cinco aperturas.
 */
@CapacitorPlugin(name = "OtaPending")
public class OtaPendingPlugin extends Plugin {

    private static final String PREFS = "noutlife_ota";
    private static final String KEY = "pending";

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void get(PluginCall call) {
        JSObject result = new JSObject();
        result.put("id", prefs(getContext()).getString(KEY, null));
        call.resolve(result);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String id = call.getString("id");
        SharedPreferences.Editor editor = prefs(getContext()).edit();
        if (id == null) editor.remove(KEY);
        else editor.putString(KEY, id);
        editor.commit();
        call.resolve();
    }

    /**
     * Deja la versión lista para que el WebView la cargue desde el principio. Es lo mismo que guarda el plugin al
     * cambiar de versión: si no llega a arrancar, vuelve atrás como con cualquier otra. La marca se borra antes de
     * intentarlo, para que una versión que falle no pueda repetirse en bucle.
     */
    static void applyPending(Context context) {
        SharedPreferences prefs = prefs(context);
        String id = prefs.getString(KEY, null);
        if (id == null) return;
        prefs.edit().remove(KEY).commit();
        if (!id.matches("[A-Za-z0-9]+")) return;
        File bundle = new File(context.getFilesDir(), "versions/" + id);
        if (!new File(bundle, "index.html").isFile()) return;
        context
            .getSharedPreferences(WebView.WEBVIEW_PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(WebView.CAP_SERVER_PATH, bundle.getPath())
            .commit();
    }
}
