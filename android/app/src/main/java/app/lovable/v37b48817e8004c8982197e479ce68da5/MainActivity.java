package app.lovable.v37b48817e8004c8982197e479ce68da5;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register the SocialLogin plugin
        try {
            registerPlugin(SocialLoginPlugin.class);
        } catch (Exception e) {
            // Plugin registration failed, continue without it
            android.util.Log.w("MainActivity", "SocialLoginPlugin registration failed: " + e.getMessage());
        }
        
        super.onCreate(savedInstanceState);
    }
}
