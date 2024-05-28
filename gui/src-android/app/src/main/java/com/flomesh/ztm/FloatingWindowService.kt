package com.flomesh.ztm

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import androidx.annotation.Nullable
import android.graphics.PixelFormat
import android.widget.ImageView
import android.animation.ObjectAnimator
import android.util.Log
import android.view.animation.LinearInterpolator

class FloatingWindowService : Service(), Application.ActivityLifecycleCallbacks {

    private lateinit var windowManager: WindowManager
    private lateinit var floatingView: View

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onCreate() {
        super.onCreate()
        requestOverlayPermissionIfNeeded()
        (applicationContext as Application).registerActivityLifecycleCallbacks(this)
        Log.d("FloatingWindowService", "Service Created")
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        Log.d("FloatingWindowService", "onActivityCreated")
    }

    override fun onActivityStarted(activity: Activity) {
        Log.d("FloatingWindowService", "onActivityStarted")
    }

    override fun onActivityResumed(activity: Activity) {
        Log.d("FloatingWindowService", "onActivityResumed")
				floatingView.visibility = View.INVISIBLE
    }

    override fun onActivityPaused(activity: Activity) {
        Log.d("FloatingWindowService", "onActivityPaused")
				floatingView.visibility = View.VISIBLE
    }

    override fun onActivityStopped(activity: Activity) {
        Log.d("FloatingWindowService", "onActivityStopped")
    }

    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {
        Log.d("FloatingWindowService", "onActivitySaveInstanceState")
    }

    override fun onActivityDestroyed(activity: Activity) {
        Log.d("FloatingWindowService", "onActivityDestroyed")
				floatingView.visibility = View.INVISIBLE
    }

    private fun requestOverlayPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                startActivity(intent)
            } else {
                createFloatingWindow()
            }
        } else {
            createFloatingWindow()
        }
    }

    private fun createFloatingWindow() {
        floatingView = LayoutInflater.from(this).inflate(R.layout.layout_floating_window, null)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        )

        params.gravity = Gravity.BOTTOM or Gravity.END
        params.x = 15
        params.y = 100

        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        windowManager.addView(floatingView, params)

        floatingView.findViewById<View>(R.id.close_button).setOnClickListener {
            stopSelf()
        }

        val floatingImage = floatingView.findViewById<ImageView>(R.id.floating_image)
        startImageRotation(floatingImage)
        
        floatingView.setOnTouchListener(object : View.OnTouchListener {
            private var initialX: Int = 0
            private var initialY: Int = 0
            private var initialTouchX: Float = 0f
            private var initialTouchY: Float = 0f

            override fun onTouch(v: View, event: MotionEvent): Boolean {
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = params.x
                        initialY = params.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
												floatingView.alpha = 0.8f;
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        params.x = initialX - (event.rawX - initialTouchX).toInt()
                        params.y = initialY - (event.rawY - initialTouchY).toInt()
                        windowManager.updateViewLayout(floatingView, params)
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
											floatingView.alpha = 0.5f;
											if((event.rawX - initialTouchX).toInt() == 0 && (event.rawY - initialTouchY).toInt() ==0){
												val intent = Intent(applicationContext, MainActivity::class.java)
												intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
												startActivity(intent)
											}
											return true
                    }
										
										
                }
                return false
            }
        })
    }

    private fun startImageRotation(imageView: ImageView) {
        val animator = ObjectAnimator.ofFloat(imageView, "rotation", 0f, 360f)
        animator.duration = 3000
        animator.repeatCount = ObjectAnimator.INFINITE 
        animator.repeatMode = ObjectAnimator.RESTART
        animator.interpolator = LinearInterpolator()
        animator.start()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        if (this::floatingView.isInitialized) {
            windowManager.removeView(floatingView)
            (applicationContext as Application).unregisterActivityLifecycleCallbacks(this)
        }
        Log.d("FloatingWindowService", "Service Destroyed")
    }
}
