const http = require('node:http');
const { readFile, writeFile, mkdir, access, chmod } = require('node:fs/promises');
const path = require('node:path');
const { constants } = require('node:fs');

const PORT = Number(process.env.PORT || 3101);
const HOST = process.env.HOST || '0.0.0.0';
const OUTPUT_ROOT = path.join(process.cwd(), 'generated-apps');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'converted-app';
}

function detectKind(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.html', '.htm'].includes(ext)) {
    return { kind: 'web', label: 'Web page', mimeType: 'text/html' };
  }
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
    return { kind: 'media', label: 'Media', mimeType: 'application/octet-stream' };
  }
  return { kind: 'text', label: 'Text document', mimeType: 'text/plain' };
}

async function ensureFileExists(filePath) {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function createAndroidScaffold({ appName, filePath }) {
  const analysis = detectKind(filePath);
  const projectName = slugify(appName || path.basename(filePath, path.extname(filePath)) || 'ConvertedApp');
  const projectDir = path.join(OUTPUT_ROOT, projectName);
  const packageName = `com.example.${projectName}`;

  const javaDir = path.join(projectDir, 'app', 'src', 'main', 'java', 'com', 'example', projectName);
  const assetsDir = path.join(projectDir, 'app', 'src', 'main', 'assets');
  const valuesDir = path.join(projectDir, 'app', 'src', 'main', 'res', 'values');
  const layoutDir = path.join(projectDir, 'app', 'src', 'main', 'res', 'layout');
  const drawableDir = path.join(projectDir, 'app', 'src', 'main', 'res', 'drawable');

  await mkdir(javaDir, { recursive: true });
  await mkdir(assetsDir, { recursive: true });
  await mkdir(valuesDir, { recursive: true });
  await mkdir(layoutDir, { recursive: true });
  await mkdir(drawableDir, { recursive: true });

  const inputBuffer = await readFile(filePath);
  const inputText = inputBuffer.toString('utf8');
  const assetName = analysis.kind === 'web' ? 'source.html' : 'source.txt';
  const assetPath = path.join(assetsDir, assetName);
  const escapedHtml = inputText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const assetContent = analysis.kind === 'web' ? inputText : `<html><body><pre>${escapedHtml}</pre></body></html>`;

  await writeFile(assetPath, assetContent, 'utf8');

  const activityPath = path.join(javaDir, 'MainActivity.java');
  const manifestPath = path.join(projectDir, 'app', 'src', 'main', 'AndroidManifest.xml');
  const layoutPath = path.join(layoutDir, 'activity_main.xml');
  const stringsPath = path.join(valuesDir, 'strings.xml');
  const colorsPath = path.join(valuesDir, 'colors.xml');
  const themesPath = path.join(valuesDir, 'themes.xml');
  const appGradlePath = path.join(projectDir, 'app', 'build.gradle');
  const rootGradlePath = path.join(projectDir, 'build.gradle');
  const settingsPath = path.join(projectDir, 'settings.gradle');
  const gradlePropertiesPath = path.join(projectDir, 'gradle.properties');
  const localPropertiesPath = path.join(projectDir, 'local.properties');
  const gradlewPath = path.join(projectDir, 'gradlew');
  const gradlewBatPath = path.join(projectDir, 'gradlew.bat');
  const buildScriptPath = path.join(projectDir, 'build-apk.sh');

  const activityCode = `package ${packageName};

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_main);

    WebView webView = findViewById(R.id.webView);
    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setAllowFileAccess(true);
    settings.setDomStorageEnabled(true);
    webView.loadUrl("file:///android_asset/${assetName}");
  }
}
`;

  const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${packageName}">
  <application
      android:label="${appName || projectName}"
      android:theme="@style/Theme.AppCompat.Light.NoActionBar">
    <activity
        android:name=".${projectName === 'converted-app' ? 'MainActivity' : 'MainActivity'}"
        android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>
`;

  const layout = `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">
  <WebView
      android:id="@+id/webView"
      android:layout_width="match_parent"
      android:layout_height="match_parent" />
</FrameLayout>
`;

  const strings = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="app_name">${appName || projectName}</string>
</resources>
`;

  const colors = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="purple_500">#6200EE</color>
</resources>
`;

  const themes = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="Theme.AppCompat.Light.NoActionBar" parent="Theme.AppCompat.Light.NoActionBar">
    <item name="android:statusBarColor">@color/purple_500</item>
  </style>
</resources>
`;

  const appGradle = `plugins {
  id 'com.android.application'
}

android {
  namespace '${packageName}'
  compileSdk 34

  defaultConfig {
    applicationId '${packageName}'
    minSdk 24
    targetSdk 34
    versionCode 1
    versionName "1.0"
  }

  buildTypes {
    release {
      minifyEnabled false
    }
  }
}

dependencies {
  implementation 'androidx.appcompat:appcompat:1.8.0'
}
`;

  const rootGradle = `plugins {
  id 'com.android.application' version '8.2.2' apply false
}
`;

  const settingsGradle = `pluginManagement {
  repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
  }
}

dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
  repositories {
    google()
    mavenCentral()
  }
}

rootProject.name = '${projectName}'
include ':app'
`;

  const gradleProperties = `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
`;

  const localProperties = `sdk.dir=$HOME/android-sdk
`;

  const gradlew = `#!/bin/bash
set -e
if ! command -v gradle >/dev/null 2>&1; then
  pkg install -y gradle >/dev/null 2>&1 || true
fi
if ! command -v gradle >/dev/null 2>&1; then
  echo "Gradle is not installed. Run: pkg install -y gradle"
  exit 1
fi
gradle "$@"
`;

  const gradlewBat = `@echo off
java -jar gradle-wrapper.jar %*
`;

  const buildScript = `#!/bin/bash
set -e
pkg update -y
pkg install -y git wget unzip openjdk-17 gradle
mkdir -p "$HOME/android-sdk/cmdline-tools"
cd "$HOME/android-sdk"
if [ ! -x "$HOME/android-sdk/cmdline-tools/latest/bin/sdkmanager" ]; then
  wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip
  rm -rf "$HOME/android-sdk/cmdline-tools/latest"
  unzip -q cmdline-tools.zip -d "$HOME/android-sdk/cmdline-tools"
  mkdir -p "$HOME/android-sdk/cmdline-tools/latest"
  cp -r "$HOME/android-sdk/cmdline-tools/cmdline-tools/"* "$HOME/android-sdk/cmdline-tools/latest/"
fi
export ANDROID_SDK_ROOT="$HOME/android-sdk"
export PATH="$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools"
if ! command -v sdkmanager >/dev/null 2>&1; then
  echo "sdkmanager not found"
  exit 1
fi
yes | sdkmanager --licenses >/dev/null 2>&1 || true
yes | sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" >/dev/null 2>&1 || true
cat > local.properties <<'EOF'
sdk.dir=$HOME/android-sdk
EOF
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk || true
`;

  await writeFile(activityPath, activityCode, 'utf8');
  await writeFile(manifestPath, manifest, 'utf8');
  await writeFile(layoutPath, layout, 'utf8');
  await writeFile(stringsPath, strings, 'utf8');
  await writeFile(colorsPath, colors, 'utf8');
  await writeFile(themesPath, themes, 'utf8');
  await writeFile(appGradlePath, appGradle, 'utf8');
  await writeFile(rootGradlePath, rootGradle, 'utf8');
  await writeFile(settingsPath, settingsGradle, 'utf8');
  await writeFile(gradlePropertiesPath, gradleProperties, 'utf8');
  await writeFile(localPropertiesPath, localProperties, 'utf8');
  await writeFile(gradlewPath, gradlew, 'utf8');
  await writeFile(gradlewBatPath, gradlewBat, 'utf8');
  await writeFile(buildScriptPath, buildScript, 'utf8');
  await chmod(gradlewPath, 0o755);
  await chmod(buildScriptPath, 0o755);

  return { projectDir, analysis, buildScriptPath };
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (req.url === '/' && req.method === 'GET') {
    try {
      const html = await readFile(path.join(process.cwd(), 'public', 'index.html'), 'utf8');
      sendHtml(res, 200, html);
      return;
    } catch (error) {
      sendJson(res, 500, { status: 'error', message: error.message });
      return;
    }
  }

  if (req.url === '/api/convert' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const filePath = body.filePath;
      const appName = body.appName || path.basename(filePath || 'ConvertedApp');

      if (!filePath) {
        sendJson(res, 400, { status: 'error', message: 'filePath is required' });
        return;
      }

      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
      const exists = await ensureFileExists(absolutePath);

      if (!exists) {
        sendJson(res, 404, { status: 'error', message: 'File not found' });
        return;
      }

      const { projectDir, analysis, buildScriptPath } = await createAndroidScaffold({ appName, filePath: absolutePath });
      sendJson(res, 200, {
        status: 'ok',
        message: 'Real Android APK project scaffold generated',
        analysis,
        outputPath: projectDir,
        buildScriptPath,
        installHint: 'Run the generated build-apk.sh script in Termux on your Android device.'
      });
    } catch (error) {
      sendJson(res, 500, { status: 'error', message: error.message });
    }
    return;
  }

  sendJson(res, 404, { status: 'error', message: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
