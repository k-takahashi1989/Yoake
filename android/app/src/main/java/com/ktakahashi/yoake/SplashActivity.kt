package com.ktakahashi.yoake

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity

class SplashActivity : AppCompatActivity() {

  companion object {
    private const val SPLASH_DELAY_MS = 1000L
  }

  private val launchHandler = Handler(Looper.getMainLooper())
  private val launchMainRunnable = Runnable {
    startActivity(
        Intent(this, MainActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        })
    overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
    finish()
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
