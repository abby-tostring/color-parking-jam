import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  Platform,
  StyleSheet,
  View,
  StatusBar,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
// Temporarily disabled for Expo Go development:
// import mobileAds, {
//   BannerAd,
//   BannerAdSize,
//   TestIds,
// } from 'react-native-google-mobile-ads';

import { gameHTML } from './src/game/gameHTML';

export default function App() {
  const [adsInitialized, setAdsInitialized] = useState(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    /*
    // Enable this when running a native EAS build with AdMob configured.

    if (Platform.OS === 'web') return;

    let active = true;

    mobileAds()
      .initialize()
      .then(() => {
        if (active) {
          setAdsInitialized(true);
        }
      })
      .catch((error) => {
        console.warn(
          'Google Mobile Ads initialization failed:',
          error
        );
      });

    return () => {
      active = false;
    };
    */
  }, []);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      console.log('Bridge Message from Phaser:', data);

      // Mock rewarded-ad handler while testing.
      if (
        data.type === 'UNLOCK_SLOT_AD' ||
        data.type === 'SHOW_REWARDED_AD'
      ) {
        Alert.alert(
          'Expo Go Ad Mode',
          'Ad skipped for testing! Slot unlocked.',
          [
            {
              text: 'OK',
              onPress: () => {
                webViewRef.current?.postMessage(
                  JSON.stringify({
                    type: 'UNLOCK_SLOT_REWARDED',
                    completed: true,
                  })
                );
              },
            },
          ]
        );
      }
    } catch (e) {
      console.log(
        'Raw Message:',
        event.nativeEvent.data
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#101827"
      />

      <View style={styles.gameColumn}>
        <View style={styles.webviewContainer}>
          <WebView
            ref={webViewRef}

            /*
             * IMPORTANT:
             * Use a real base URL instead of leaving the
             * HTML document with an opaque/null origin.
             * This prevents localStorage from being rejected
             * by Android WebView.
             */
            source={{
              html: gameHTML,
              baseUrl: 'https://colorparkingjam.app/',
            }}

            style={styles.webview}

            originWhitelist={['*']}

            javaScriptEnabled={true}
            domStorageEnabled={true}

            /*
             * Android WebView settings
             */
            setSupportMultipleWindows={false}
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
            mixedContentMode="always"

            /*
             * Game settings
             */
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}

            /*
             * Debugging / error handling
             */
            onError={(event) => {
              console.warn(
                'WebView error:',
                event.nativeEvent
              );
            }}

            onHttpError={(event) => {
              console.warn(
                'WebView HTTP error:',
                event.nativeEvent
              );
            }}

            onLoadStart={() => {
              console.log('Color Parking Jam WebView loading...');
            }}

            onLoadEnd={() => {
              console.log('Color Parking Jam WebView loaded.');
            }}

            onMessage={handleMessage}

            /*
             * Keep Android WebView from trying to open
             * links outside the game.
             */
            setBuiltInZoomControls={false}
            setDisplayZoomControls={false}
          />
        </View>

        {/* 
          AdMob banner.

          Keep this commented while testing in Expo Go.
          Re-enable it in a native EAS build once AdMob
          is configured.
        */}

        {/*
        {adsInitialized && Platform.OS !== 'web' && (
          <View style={styles.bannerContainer}>
            <BannerAd
              unitId={TestIds.BANNER}
              size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
              onAdFailedToLoad={(error) =>
                console.warn(
                  'Banner ad failed to load:',
                  error
                )
              }
            />
          </View>
        )}
        */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101827',
  },

  gameColumn: {
    flex: 1,
  },

  webviewContainer: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },

  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  bannerContainer: {
    flex: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});

