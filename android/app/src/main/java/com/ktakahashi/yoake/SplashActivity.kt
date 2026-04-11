package com.ktakahashi.yoake

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.ImageView
import androidx.appcompat.app.AppCompatActivity

class SplashActivity : AppCompatActivity() {

  companion object {
    private const val SPLASH_DELAY_MS = 800L
    private const val ZOOM_DURATION_MS = 400L
  }

  private val launchHandler = Handler(Looper.getMainLooper())
  private val launchMainRunnable = Runnable {
    val splashImage = findViewById<ImageView>(R.id.splashImage)
    splashImage.animate()
      .scaleX(1.3f)
      .scaleY(1.3f)
      .alpha(0f)
      .setDuration(ZOOM_DURATION_MS)
      .withEndAction {
        startActivity(
          Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
          }
        )
        overridePendingTransition(android.R.anim.fade_in, 0)
        finish()
      }
      .start()
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (!isTaskRoot &&
        intent?.action == Intent.ACTION_MAIN &&
        intent?.hasCategory(Intent.CATEGORY_LAUNCHER) == true) {
      finish()
      return
    }

    setContentView(R.layout.activity_splash)
    launchHandler.postDelayed(launchMainRunnable, SPLASH_DELAY_MS)
  }

  override fun onDestroy() {
    launchHandler.removeCallbacks(launchMainRunnable)
    super.onDestroy()
  }
}
