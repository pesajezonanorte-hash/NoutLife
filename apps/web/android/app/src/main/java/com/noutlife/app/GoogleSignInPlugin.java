package com.noutlife.app;

import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/**
 * Acceso con Google por Credential Manager: Google no deja iniciar sesión dentro de un WebView.
 * Devuelve el mismo ID token que el botón de la web, firmado para el cliente web (clientId), así
 * que la API lo valida igual. Para el token, Google exige un cliente OAuth «Android» con este
 * paquete y el SHA-1 de la firma del APK en el mismo proyecto de Google Cloud.
 */
@CapacitorPlugin(name = "GoogleSignIn")
public class GoogleSignInPlugin extends Plugin {

    @PluginMethod
    public void signIn(PluginCall call) {
        String clientId = call.getString("clientId");
        if (clientId == null || clientId.isEmpty()) {
            call.reject("clientId requerido");
            return;
        }

        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(new GetSignInWithGoogleOption.Builder(clientId).build())
            .build();

        CredentialManager.create(getContext()).getCredentialAsync(
            getActivity(),
            request,
            null,
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    Credential credential = result.getCredential();
                    if (!(credential instanceof CustomCredential) || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                        call.reject("Credencial inesperada: " + credential.getType());
                        return;
                    }
                    GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                    JSObject ret = new JSObject();
                    ret.put("idToken", google.getIdToken());
                    ret.put("displayName", google.getDisplayName());
                    call.resolve(ret);
                }

                @Override
                public void onError(GetCredentialException e) {
                    call.reject(e.getMessage(), e instanceof GetCredentialCancellationException ? "CANCELLED" : e.getType());
                }
            }
        );
    }
}
