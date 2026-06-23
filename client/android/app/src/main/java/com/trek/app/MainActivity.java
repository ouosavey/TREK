package com.trek.app;

import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.app.Activity;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Set navigation bar color to match app theme (white in light, #09090b in dark)
        // Theme.SplashScreen parent may override navigationBarColor, so we set it at runtime.
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        int nightModeFlags = getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK;
        if (nightModeFlags == android.content.res.Configuration.UI_MODE_NIGHT_YES) {
            window.setNavigationBarColor(android.graphics.Color.parseColor("#09090b"));
            // Dark nav bar → light icons
            window.getDecorView().setSystemUiVisibility(window.getDecorView().getSystemUiVisibility() & ~android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        } else {
            window.setNavigationBarColor(android.graphics.Color.parseColor("#ffffff"));
            // Light nav bar → dark icons
            window.getDecorView().setSystemUiVisibility(android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
    }
}
