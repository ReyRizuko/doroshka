#!/usr/bin/env python3
"""Добавляет в Android-проект нативный плеер (очередь, фон, уведомление, выбор файлов).

Запускается после `npx cap add android`. Создаёт Java-файлы и правит AndroidManifest.xml.
"""
import os
import re
import sys

PKG = "app.dorozhka.player"
ROOT = os.path.dirname(os.path.abspath(__file__))
ANDROID = os.path.join(ROOT, "android", "app", "src", "main")
JAVA_DIR = os.path.join(ANDROID, "java", *PKG.split("."))
MANIFEST = os.path.join(ANDROID, "AndroidManifest.xml")

if not os.path.isfile(MANIFEST):
    sys.exit("Не найден " + MANIFEST + ". Сначала выполните: npx cap add android")
os.makedirs(JAVA_DIR, exist_ok=True)

FILES = {}

FILES['ControlReceiver.java'] = r'''package app.dorozhka.player;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class ControlReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String a = intent == null ? null : intent.getAction();
        if (a == null) return;
        PlaybackService s = PlaybackService.instance;
        if (s != null) s.onControl(a.substring(a.lastIndexOf('.') + 1));
    }
}
'''

FILES['MainActivity.java'] = r'''package app.dorozhka.player;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlaybackPlugin.class);
        super.onCreate(savedInstanceState);
        getBridge().getWebView().addJavascriptInterface(new SpotifyOAuthBridge(this), "SpotifyOAuth");
        captureSpotifyCallback(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureSpotifyCallback(intent);
    }

    private void captureSpotifyCallback(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri uri = intent.getData();
        if ("doroshka".equals(uri.getScheme()) && "spotify-callback".equals(uri.getHost())) {
            getSharedPreferences("doroshka_oauth", MODE_PRIVATE).edit()
                .putString("spotify_callback_url", uri.toString()).apply();
    }
}
'''



FILES['SpotifyOAuthBridge.java'] = r'''package app.dorozhka.player;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;

public class SpotifyOAuthBridge {
    private final Context context;

    public SpotifyOAuthBridge(Context context) {
        this.context = context.getApplicationContext();
    }

    @JavascriptInterface
    public String getPendingUrl() {
        return context.getSharedPreferences("doroshka_oauth", Context.MODE_PRIVATE)
            .getString("spotify_callback_url", "");
    }

    @JavascriptInterface
    public void clearPendingUrl() {
        context.getSharedPreferences("doroshka_oauth", Context.MODE_PRIVATE).edit()
            .remove("spotify_callback_url").apply();
    }

    @JavascriptInterface
    public void openAuthUrl(String value) {
        if (value == null || !value.startsWith("https://accounts.spotify.com/authorize")) return;
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(value));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }
}
'''

FILES['PlaybackPlugin.java'] = r'''package app.dorozhka.player;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;

@CapacitorPlugin(name = "Playback")
public class PlaybackPlugin extends Plugin {
    static PlaybackPlugin instance;
    private boolean asked = false;

    interface Cmd {
        void run(PlaybackService s);
    }

    @Override
    public void load() {
        instance = this;
    }

    static void emit(String event, JSObject data) {
        PlaybackPlugin p = instance;
        if (p != null) p.notifyListeners(event, data);
    }

    private void askNotifications() {
        if (asked || Build.VERSION.SDK_INT < 33) return;
        asked = true;
        final String perm = "android.permission.POST_NOTIFICATIONS";
        try {
            final Activity a = getActivity();
            if (a != null && getContext().checkSelfPermission(perm) != PackageManager.PERMISSION_GRANTED) {
                a.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        a.requestPermissions(new String[]{perm}, 4242);
                    }
                });
            }
        } catch (Exception ignored) {
        }
    }

    private void run(PluginCall call, final Cmd cmd) {
        PlaybackService.post(new Runnable() {
            @Override
            public void run() {
                PlaybackService s = PlaybackService.instance;
                if (s != null) cmd.run(s);
            }
        });
        call.resolve();
    }

    @PluginMethod
    public void setQueue(PluginCall call) {
        askNotifications();
        PlaybackService.repeat = call.getInt("repeat", 0);
        Intent i = new Intent(getContext(), PlaybackService.class);
        i.setAction(PlaybackService.ACTION_CMD);
        i.putExtra("cmd", "queue");
        i.putExtra("json", call.getData().toString());
        try {
            if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i);
            else getContext().startService(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void toggle(PluginCall call) {
        run(call, new Cmd() { public void run(PlaybackService s) { s.toggle(); } });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        run(call, new Cmd() { public void run(PlaybackService s) { s.pause(false); } });
    }

    @PluginMethod
    public void resume(PluginCall call) {
        run(call, new Cmd() { public void run(PlaybackService s) { s.resume(); } });
    }

    @PluginMethod
    public void next(PluginCall call) {
        run(call, new Cmd() { public void run(PlaybackService s) { s.next(); } });
    }

    @PluginMethod
    public void prev(PluginCall call) {
        run(call, new Cmd() { public void run(PlaybackService s) { s.prev(); } });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        run(call, new Cmd() { public void run(PlaybackService s) { s.stopAll(); } });
    }

    @PluginMethod
    public void seek(PluginCall call) {
        final int ms = call.getInt("ms", 0);
        run(call, new Cmd() { public void run(PlaybackService s) { s.seekTo(ms); } });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Double d = call.getDouble("v", 1.0);
        final float v = d == null ? 1f : Math.max(0f, Math.min(1f, d.floatValue()));
        PlaybackService.volume = v;
        run(call, new Cmd() { public void run(PlaybackService s) { s.applyVolume(); } });
    }

    @PluginMethod
    public void setRepeat(PluginCall call) {
        PlaybackService.repeat = call.getInt("mode", 0);
        call.resolve();
    }

    // ---- выбор файлов ----
    @PluginMethod
    public void pick(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("audio/*");
        i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, i, "pickResult");
    }

    @ActivityCallback
    private void pickResult(final PluginCall call, ActivityResult result) {
        if (call == null) return;
        final ArrayList<Uri> uris = new ArrayList<>();
        if (result != null && result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Intent d = result.getData();
            ClipData cd = d.getClipData();
            if (cd != null) {
                for (int k = 0; k < cd.getItemCount(); k++) uris.add(cd.getItemAt(k).getUri());
            } else if (d.getData() != null) {
                uris.add(d.getData());
            }
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                JSArray arr = new JSArray();
                for (Uri u : uris) {
                    try {
                        getContext().getContentResolver().takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    } catch (Exception ignored) {
                    }
                    arr.put(readMeta(u));
                }
                JSObject o = new JSObject();
                o.put("files", arr);
                call.resolve(o);
            }
        }).start();
    }

    private JSObject readMeta(Uri u) {
        JSObject f = new JSObject();
        f.put("uri", u.toString());
        String name = "";
        Cursor c = null;
        try {
            c = getContext().getContentResolver().query(u, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
            if (c != null && c.moveToFirst()) name = c.getString(0);
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
        f.put("name", name == null ? "" : name);
        MediaMetadataRetriever r = new MediaMetadataRetriever();
        try {
            r.setDataSource(getContext(), u);
            String t = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE);
            String a = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST);
            String al = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM);
            String du = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            f.put("title", t == null ? "" : t);
            f.put("artist", a == null ? "" : a);
            f.put("album", al == null ? "" : al);
            long ms = 0;
            try {
                ms = Long.parseLong(du);
            } catch (Exception ignored) {
            }
            f.put("dur", ms / 1000);
        } catch (Exception ignored) {
        } finally {
            try {
                r.release();
            } catch (Exception ignored) {
            }
        }
        return f;
    }
}
'''

FILES['PlaybackService.java'] = r'''package app.dorozhka.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.graphics.drawable.Icon;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.MediaPlayer;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import com.getcapacitor.JSObject;
import java.util.ArrayList;
import org.json.JSONArray;
import org.json.JSONObject;

/** Нативный плеер: очередь, воспроизведение и уведомление живут здесь, а не в WebView. */
public class PlaybackService extends Service implements AudioManager.OnAudioFocusChangeListener {
    static PlaybackService instance;
    static final String ACTION_CMD = "app.dorozhka.player.CMD";
    static volatile float volume = 1f;
    static volatile int repeat = 0; // 0 выкл, 1 все, 2 один

    private static final String CHANNEL = "playback";
    private static final int NOTIFICATION_ID = 7;

    private static class Item {
        String id = "", url = "", title = "", artist = "", album = "";
    }

    private final ArrayList<Item> queue = new ArrayList<>();
    private int index = -1;
    private MediaPlayer mp;
    private boolean prepared = false;
    private boolean wantPlay = false;
    private boolean pausedByFocus = false;
    private boolean foreground = false;
    private int errRun = 0;
    private MediaSession session;
    private AudioManager audio;
    private WifiManager.WifiLock wifiLock;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private final BroadcastReceiver noisy = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            pause(false);
        }
    };

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            emitState();
            if (isPlaying()) handler.postDelayed(this, 500);
        }
    };

    static void post(Runnable r) {
        PlaybackService s = instance;
        if (s != null) s.handler.post(r);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        session = new MediaSession(this, "Dorozhka");
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                resume();
            }

            @Override
            public void onPause() {
                PlaybackService.this.pause(false);
            }

            @Override
            public void onSkipToNext() {
                next();
            }

            @Override
            public void onSkipToPrevious() {
                prev();
            }

            @Override
            public void onSeekTo(long pos) {
                seekTo((int) pos);
            }

            @Override
            public void onStop() {
                stopAll();
            }
        });
        session.setActive(true);
        registerReceiver(noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "dorozhka:wifi");
                wifiLock.setReferenceCounted(false);
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            goForeground();
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (intent != null && ACTION_CMD.equals(intent.getAction())) {
            String cmd = intent.getStringExtra("cmd");
            String json = intent.getStringExtra("json");
            try {
                if ("queue".equals(cmd) && json != null) setQueue(new JSONObject(json));
            } catch (Exception e) {
                emitError("");
            }
        }
        if (queue.isEmpty()) stopAll();
        return START_NOT_STICKY;
    }

    // ---------- очередь ----------
    private void setQueue(JSONObject o) {
        JSONArray arr = o.optJSONArray("items");
        ArrayList<Item> list = new ArrayList<>();
        if (arr != null) {
            for (int i = 0; i < arr.length(); i++) {
                JSONObject j = arr.optJSONObject(i);
                if (j == null) continue;
                Item it = new Item();
                it.id = j.optString("id", "");
                it.url = j.optString("url", "");
                it.title = j.optString("title", "");
                it.artist = j.optString("artist", "");
                it.album = j.optString("album", "");
                if (!it.url.isEmpty()) list.add(it);
            }
        }
        int idx = o.optInt("index", 0);
        boolean keep = o.optBoolean("keep", false);
        String curId = current() == null ? null : current().id;
        queue.clear();
        queue.addAll(list);
        if (queue.isEmpty()) {
            stopAll();
            return;
        }
        if (idx < 0 || idx >= queue.size()) idx = 0;
        if (keep && curId != null && mp != null && curId.equals(queue.get(idx).id)) {
            index = idx;
            updateNotification();
            emitState();
            return;
        }
        errRun = 0;
        startIndex(idx, true);
    }

    private Item current() {
        return (index >= 0 && index < queue.size()) ? queue.get(index) : null;
    }

    private void releasePlayer() {
        handler.removeCallbacks(ticker);
        if (mp != null) {
            try {
                mp.setOnPreparedListener(null);
                mp.setOnCompletionListener(null);
                mp.setOnErrorListener(null);
                mp.reset();
                mp.release();
            } catch (Exception ignored) {
            }
            mp = null;
        }
        prepared = false;
    }

    private void startIndex(int i, boolean play) {
        if (i < 0 || i >= queue.size()) return;
        index = i;
        wantPlay = play;
        pausedByFocus = false;
        releasePlayer();
        final MediaPlayer p = new MediaPlayer();
        mp = p;
        p.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build());
        p.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK);
        p.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
            @Override
            public void onPrepared(MediaPlayer m) {
                if (m != mp) return;
                prepared = true;
                errRun = 0;
                m.setVolume(volume, volume);
                if (wantPlay) startPlayback();
                updateSession();
                updateNotification();
                emitState();
            }
        });
        p.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
            @Override
            public void onCompletion(MediaPlayer m) {
                if (m != mp) return;
                handler.post(new Runnable() {
                    @Override
                    public void run() {
                        onTrackEnd();
                    }
                });
            }
        });
        p.setOnErrorListener(new MediaPlayer.OnErrorListener() {
            @Override
            public boolean onError(MediaPlayer m, int what, int extra) {
                if (m != mp) return true;
                handler.post(new Runnable() {
                    @Override
                    public void run() {
                        onTrackError();
                    }
                });
                return true;
            }
        });
        try {
            p.setDataSource(getApplicationContext(), Uri.parse(queue.get(i).url));
            p.prepareAsync();
        } catch (Exception e) {
            handler.post(new Runnable() {
                @Override
                public void run() {
                    onTrackError();
                }
            });
            return;
        }
        if (wifiLock != null && !wifiLock.isHeld()) {
            try {
                wifiLock.acquire();
            } catch (Exception ignored) {
            }
        }
        updateSession();
        updateNotification();
        emitState();
    }

    private void onTrackEnd() {
        if (mp == null || queue.isEmpty()) return;
        if (repeat == 2) {
            try {
                mp.seekTo(0);
                mp.start();
                handler.removeCallbacks(ticker);
                handler.post(ticker);
            } catch (Exception ignored) {
            }
            return;
        }
        if (index < queue.size() - 1) {
            startIndex(index + 1, true);
        } else if (repeat == 1) {
            startIndex(0, true);
        } else {
            wantPlay = false;
            handler.removeCallbacks(ticker);
            updateSession();
            updateNotification();
            emitState();
        }
    }

    private void onTrackError() {
        Item it = current();
        emitError(it == null ? "" : it.title);
        errRun++;
        if (queue.size() > 1 && errRun < queue.size()) {
            int n = index + 1;
            if (n >= queue.size()) n = 0;
            startIndex(n, true);
        } else {
            wantPlay = false;
            prepared = false;
            handler.removeCallbacks(ticker);
            updateSession();
            updateNotification();
            emitState();
        }
    }

    // ---------- управление ----------
    boolean isPlaying() {
        try {
            return mp != null && prepared && mp.isPlaying();
        } catch (Exception e) {
            return false;
        }
    }

    private boolean requestFocus() {
        try {
            return audio.requestAudioFocus(this, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
                    == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        } catch (Exception e) {
            return true;
        }
    }

    private void startPlayback() {
        if (mp == null || !prepared) return;
        if (!requestFocus()) {
            wantPlay = false;
            return;
        }
        try {
            mp.start();
        } catch (Exception e) {
            return;
        }
        handler.removeCallbacks(ticker);
        handler.post(ticker);
    }

    void pause(boolean byFocus) {
        wantPlay = false;
        pausedByFocus = byFocus;
        try {
            if (mp != null && prepared && mp.isPlaying()) mp.pause();
        } catch (Exception ignored) {
        }
        handler.removeCallbacks(ticker);
        updateSession();
        updateNotification();
        emitState();
    }

    void resume() {
        if (queue.isEmpty()) return;
        wantPlay = true;
        pausedByFocus = false;
        if (mp != null && prepared) startPlayback();
        else if (mp == null && index >= 0) startIndex(index, true);
        updateSession();
        updateNotification();
        emitState();
    }

    void toggle() {
        if (isPlaying() || (wantPlay && !prepared)) pause(false);
        else resume();
    }

    void next() {
        if (queue.isEmpty()) return;
        int n = index + 1;
        if (n >= queue.size()) n = 0;
        errRun = 0;
        startIndex(n, true);
    }

    void prev() {
        if (queue.isEmpty()) return;
        try {
            if (mp != null && prepared && mp.getCurrentPosition() > 3000) {
                mp.seekTo(0);
                emitState();
                return;
            }
        } catch (Exception ignored) {
        }
        int p = index - 1;
        if (p < 0) p = queue.size() - 1;
        errRun = 0;
        startIndex(p, true);
    }

    void seekTo(int ms) {
        try {
            if (mp != null && prepared) mp.seekTo(Math.max(0, ms));
        } catch (Exception ignored) {
        }
        updateSession();
        emitState();
    }

    void applyVolume() {
        try {
            if (mp != null && prepared) mp.setVolume(volume, volume);
        } catch (Exception ignored) {
        }
    }

    void stopAll() {
        handler.removeCallbacks(ticker);
        releasePlayer();
        queue.clear();
        index = -1;
        wantPlay = false;
        try {
            audio.abandonAudioFocus(this);
        } catch (Exception ignored) {
        }
        try {
            if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        } catch (Exception ignored) {
        }
        try {
            stopForeground(true);
        } catch (Exception ignored) {
        }
        foreground = false;
        PlaybackPlugin.emit("stopped", new JSObject());
        stopSelf();
    }

    void onControl(String name) {
        if ("PREV".equals(name)) prev();
        else if ("NEXT".equals(name)) next();
        else if ("TOGGLE".equals(name)) toggle();
        else if ("STOP".equals(name)) stopAll();
    }

    @Override
    public void onAudioFocusChange(int change) {
        switch (change) {
            case AudioManager.AUDIOFOCUS_LOSS:
                pause(false);
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                if (isPlaying()) pause(true);
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                try {
                    if (mp != null && prepared) mp.setVolume(volume * 0.3f, volume * 0.3f);
                } catch (Exception ignored) {
                }
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                applyVolume();
                if (pausedByFocus) resume();
                break;
            default:
                break;
        }
    }

    // ---------- события в JS ----------
    private void emitState() {
        Item it = current();
        int pos = 0, dur = 0;
        boolean playing = false;
        try {
            if (mp != null && prepared) {
                pos = mp.getCurrentPosition();
                dur = mp.getDuration();
                playing = mp.isPlaying();
            }
        } catch (Exception ignored) {
        }
        JSObject o = new JSObject();
        o.put("id", it == null ? "" : it.id);
        o.put("index", index);
        o.put("playing", playing || (wantPlay && !prepared));
        o.put("pos", pos);
        o.put("dur", dur);
        PlaybackPlugin.emit("state", o);
    }

    private void emitError(String title) {
        JSObject o = new JSObject();
        o.put("title", title);
        PlaybackPlugin.emit("error", o);
    }

    // ---------- медиасессия и уведомление ----------
    private void updateSession() {
        if (session == null) return;
        Item it = current();
        int pos = 0, dur = 0;
        try {
            if (mp != null && prepared) {
                pos = mp.getCurrentPosition();
                dur = mp.getDuration();
            }
        } catch (Exception ignored) {
        }
        if (it != null) {
            session.setMetadata(new MediaMetadata.Builder()
                    .putString(MediaMetadata.METADATA_KEY_TITLE, it.title)
                    .putString(MediaMetadata.METADATA_KEY_ARTIST, it.artist)
                    .putString(MediaMetadata.METADATA_KEY_ALBUM, it.album)
                    .putLong(MediaMetadata.METADATA_KEY_DURATION, dur)
                    .build());
        }
        int st = isPlaying() ? PlaybackState.STATE_PLAYING
                : (wantPlay && !prepared ? PlaybackState.STATE_BUFFERING : PlaybackState.STATE_PAUSED);
        long actions = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE
                | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS
                | PlaybackState.ACTION_SEEK_TO | PlaybackState.ACTION_STOP;
        session.setPlaybackState(new PlaybackState.Builder().setActions(actions).setState(st, pos, 1f).build());
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "Воспроизведение", NotificationManager.IMPORTANCE_LOW);
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        }
    }

    private PendingIntent control(String name, int code) {
        Intent i = new Intent(this, ControlReceiver.class);
        i.setAction("app.dorozhka.player." + name);
        return PendingIntent.getBroadcast(this, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private Notification.Action action(int icon, String label, String name, int code) {
        return new Notification.Action.Builder(Icon.createWithResource(this, icon), label, control(name, code)).build();
    }

    private Notification buildNotification() {
        ensureChannel();
        Item it = current();
        String title = (it != null && !it.title.isEmpty()) ? it.title : "Дорожка";
        String text = it != null ? it.artist : "";
        boolean playing = isPlaying() || (wantPlay && !prepared);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CHANNEL)
                : new Notification.Builder(this);
        b.setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle(title)
                .setContentText(text)
                .setOngoing(true)
                .setShowWhen(false)
                .setVisibility(Notification.VISIBILITY_PUBLIC);
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (open != null) {
            b.setContentIntent(PendingIntent.getActivity(this, 0, open,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        }
        b.addAction(action(android.R.drawable.ic_media_previous, "Назад", "PREV", 1));
        b.addAction(action(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                playing ? "Пауза" : "Играть", "TOGGLE", 2));
        b.addAction(action(android.R.drawable.ic_media_next, "Дальше", "NEXT", 3));
        b.addAction(action(android.R.drawable.ic_menu_close_clear_cancel, "Закрыть", "STOP", 4));
        b.setStyle(new Notification.MediaStyle()
                .setMediaSession(session.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2));
        return b.build();
    }

    private void goForeground() {
        Notification n = buildNotification();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, n);
        }
        foreground = true;
    }

    private void updateNotification() {
        if (!foreground) return;
        try {
            ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).notify(NOTIFICATION_ID, buildNotification());
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopAll();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        instance = null;
        handler.removeCallbacks(ticker);
        try {
            unregisterReceiver(noisy);
        } catch (Exception ignored) {
        }
        releasePlayer();
        try {
            if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        } catch (Exception ignored) {
        }
        if (session != null) {
            session.setActive(false);
            session.release();
        }
        super.onDestroy();
    }
}
'''

for name, code in FILES.items():
    with open(os.path.join(JAVA_DIR, name), "w", encoding="utf-8") as f:
        f.write(code)
    print("записан", name)

with open(MANIFEST, encoding="utf-8") as f:
    m = f.read()

if "PlaybackService" not in m:
    perms = (
        '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />\n'
        '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />\n'
        '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n'
        '    <uses-permission android:name="android.permission.WAKE_LOCK" />\n'
    )
    comps = (
        '        <service android:name="' + PKG + '.PlaybackService" android:exported="false"'
        ' android:foregroundServiceType="mediaPlayback" />\n'
        '        <receiver android:name="' + PKG + '.ControlReceiver" android:exported="false" />\n'
    )
    m, n1 = re.subn(r"(\s*)<application", "\n" + perms + r"\1<application", m, count=1)
    m, n2 = re.subn(r"</application>", comps + "    </application>", m, count=1)
    if n1 != 1 or n2 != 1:
        sys.exit("Не удалось изменить AndroidManifest.xml")
    with open(MANIFEST, "w", encoding="utf-8") as f:
        f.write(m)
    print("AndroidManifest.xml обновлён")
else:
    print("AndroidManifest.xml уже обновлён")

# ---- Spotify OAuth deep link ----
if 'android:host="spotify-callback"' not in m:
    activity_re = r'<activity\\b(?=[^>]*android:name="(?:\\.MainActivity|' + re.escape(PKG + '.MainActivity') + r')")[^>]*>'
    match = re.search(activity_re, m)
    if not match:
        sys.exit("Не найдена MainActivity для Spotify OAuth deep link")
    tag = match.group(0)
    if 'android:launchMode=' not in tag:
        tag = tag[:-1] + ' android:launchMode="singleTask">'
    intent_filter = (
        '\\n            <intent-filter>\\n'
        '                <action android:name="android.intent.action.VIEW" />\\n'
        '                <category android:name="android.intent.category.DEFAULT" />\\n'
        '                <category android:name="android.intent.category.BROWSABLE" />\\n'
        '                <data android:scheme="doroshka" android:host="spotify-callback" />\\n'
        '            </intent-filter>'
    )
    m = m[:match.start()] + tag + intent_filter + m[match.end():]
    with open(MANIFEST, "w", encoding="utf-8") as f:
        f.write(m)
    print("Spotify OAuth deep link добавлен в AndroidManifest.xml")

# ---- capacitor.config.json: запросы идут через нативный HTTP (без ограничений CORS) ----
import json
cfg_path = os.path.join(ROOT, "capacitor.config.json")
if os.path.isfile(cfg_path):
    with open(cfg_path, encoding="utf-8") as f:
        cfg = json.load(f)
    cfg.setdefault("plugins", {}).setdefault("CapacitorHttp", {})["enabled"] = True
    with open(cfg_path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    print("capacitor.config.json обновлён")
