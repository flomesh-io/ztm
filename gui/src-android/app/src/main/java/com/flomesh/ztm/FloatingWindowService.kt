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
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ComponentName
import android.content.pm.ServiceInfo
import android.widget.Toast

class FloatingWindowService : Service(), Application.ActivityLifecycleCallbacks {

    private lateinit var windowManager: WindowManager
    private lateinit var floatingView: View

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onCreate() {
        super.onCreate()
				createNotificationChannel()
        requestOverlayPermissionIfNeeded()
				requestIgnoreBatteryOptimizations()
        (applicationContext as Application).registerActivityLifecycleCallbacks(this);
				startForegroundService();
				openAutoStartSettings()
        Log.d("FloatingWindowService", "Service Created")
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "floating_window_channel",
                "Floating Window Service Channel",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Channel for Floating Window Service"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }
    private fun startForegroundService() {
			try {
        // .setSmallIcon(R.drawable.ic_launcher)
				val notification = NotificationCompat.Builder(this, "floating_window_channel")
						.setContentTitle("Floating Window Service")
						.setContentText("ZTM is running")
						.setPriority(NotificationCompat.PRIORITY_DEFAULT)
						.setCategory(NotificationCompat.CATEGORY_SERVICE)
						.build()

				if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
						startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
				} else {
						startForeground(1, notification)
				}
			} catch (e: Exception) {
					Log.e("FloatingWindowService", "Error starting foreground service", e)
					e.printStackTrace()
					Toast.makeText(this, "Build floating_window_channel error", Toast.LENGTH_LONG).show()
			}
    }
		
    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        Log.d("FloatingWindowService", "onActivityCreated")
    }

    override fun onActivityStarted(activity: Activity) {
        Log.d("FloatingWindowService", "onActivityStarted")
    }

    override fun onActivityResumed(activity: Activity) {
        Log.d("FloatingWindowService", "onActivityResumed")
				if(floatingView != null){
					floatingView.visibility = View.INVISIBLE
				}
    }

    override fun onActivityPaused(activity: Activity) {
        Log.d("FloatingWindowService", "onActivityPaused")
				if(floatingView != null){
					floatingView.visibility = View.VISIBLE
				}
    }

    override fun onActivityStopped(activity: Activity) {
        Log.d("FloatingWindowService", "onActivityStopped")
    }

    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {
        Log.d("FloatingWindowService", "onActivitySaveInstanceState")
    }

    override fun onActivityDestroyed(activity: Activity) {
        Log.d("FloatingWindowService", "onActivityDestroyed")
				if(floatingView != null){
					floatingView.visibility = View.INVISIBLE
				}
    }

    private fun requestOverlayPermissionIfNeeded() {
			if (!Settings.canDrawOverlays(this)) {
					val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
					intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
					startActivity(intent)
			} else {
					createFloatingWindow()
			}
    }

    private fun requestIgnoreBatteryOptimizations() {
			if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
					val powerManager = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
					if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
							try {
									val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
									intent.data = Uri.parse("package:$packageName")
									intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
									startActivity(intent)
							} catch (e: Exception) {
									e.printStackTrace()
									Toast.makeText(this, "Please allow the app to ignore battery optimizations in the settings.", Toast.LENGTH_LONG).show()
							}
					}
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
				if(floatingView != null){
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
    }

    private fun startImageRotation(imageView: ImageView) {
        val animator = ObjectAnimator.ofFloat(imageView, "rotation", 0f, 360f)
        animator.duration = 3000
        animator.repeatCount = ObjectAnimator.INFINITE 
        animator.repeatMode = ObjectAnimator.RESTART
        animator.interpolator = LinearInterpolator()
        animator.start()
    }

    private fun openAutoStartSettings() {
        val intent = Intent()
        try {
            // 适配不同厂商的自启动设置页面
						Log.d("FloatingWindowService-MANUFACTURER:", Build.MANUFACTURER.lowercase())
            when (Build.MANUFACTURER.lowercase()) {
                "xiaomi" -> {
                    intent.component = ComponentName(
                        "com.miui.securitycenter",
                        "com.miui.permcenter.autostart.AutoStartManagementActivity"
                    )
                }
                "huawei" -> {
                    intent.component = ComponentName(
                        "com.huawei.systemmanager",
                        "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"
                    )
                }
                "samsung" -> {
                    intent.component = ComponentName(
                        "com.samsung.android.sm_cn",
                        "com.samsung.android.sm.ui.ram.AutoRunActivity"
                    )
                }
                else -> {
										Toast.makeText(this, "Please allow the app to auto-start in the settings.", Toast.LENGTH_LONG).show()
										return
								}
            }
            startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
            // 如果找不到对应厂商的自启动设置页面，可以提示用户手动设置
            Toast.makeText(this, "Please allow the app to auto-start in the settings.", Toast.LENGTH_LONG).show()
        }
    }
		
    override fun onDestroy() {
        super.onDestroy()
				floatingView?.let {
						windowManager.removeView(it)
				}
				(applicationContext as Application).unregisterActivityLifecycleCallbacks(this)
        Log.d("FloatingWindowService", "Service Destroyed")
    }
}
