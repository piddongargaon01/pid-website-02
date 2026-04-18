import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        fullScreenGestureEnabled: true,
        contentStyle: {
          backgroundColor: '#12141a',
        },
        statusBarStyle: 'light',
        statusBarBackgroundColor: '#12141a',
        statusBarTranslucent: false,
      }}>

      <Stack.Screen
        name="index"
        options={{
          animation: 'none',
          contentStyle: {
            backgroundColor: '#12141a',
          },
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#12141a',
          statusBarTranslucent: false,
        }}
      />

      <Stack.Screen
        name="dashboard"
        options={{
          animation: 'none',
          contentStyle: {
            backgroundColor: '#12141a',
          },
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#12141a',
          statusBarTranslucent: false,
        }}
      />

      <Stack.Screen
        name="batches"
        options={{
          animation: 'none',
          contentStyle: {
            backgroundColor: '#12141a',
          },
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#12141a',
          statusBarTranslucent: false,
        }}
      />

      <Stack.Screen
        name="ai"
        options={{
          animation: 'none',
          contentStyle: {
            backgroundColor: '#12141a',
          },
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#12141a',
          statusBarTranslucent: false,
        }}
      />

      <Stack.Screen
        name="notifications"
        options={{
          animation: 'none',
          contentStyle: {
            backgroundColor: '#12141a',
          },
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#12141a',
          statusBarTranslucent: false,
        }}
      />

      <Stack.Screen
        name="profile"
        options={{
          animation: 'none',
          contentStyle: {
            backgroundColor: '#12141a',
          },
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#12141a',
          statusBarTranslucent: false,
        }}
      />

      <Stack.Screen
        name="attendance"
        options={{
          animation: 'none',
          contentStyle: {
            backgroundColor: '#12141a',
          },
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#12141a',
          statusBarTranslucent: false,
        }}
      />

      <Stack.Screen
        name="tests"
        options={{
          animation: 'none',
          contentStyle: {
            backgroundColor: '#12141a',
          },
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#12141a',
          statusBarTranslucent: false,
        }}
      />

      <Stack.Screen
        name="performance"
        options={{
          animation: 'none',
          contentStyle: {
            backgroundColor: '#12141a',
          },
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#12141a',
          statusBarTranslucent: false,
        }}
      />

      <Stack.Screen
        name="materials"
        options={{
          animation: 'none',
          contentStyle: {
            backgroundColor: '#12141a',
          },
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#12141a',
          statusBarTranslucent: false,
        }}
      />

      <Stack.Screen
        name="chapter-detail"
        options={{
          animation: 'none',
          contentStyle: {
            backgroundColor: '#12141a',
          },
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#12141a',
          statusBarTranslucent: false,
        }}
      />

      <Stack.Screen
        name="lecture"
        options={{
          animation: 'none',
          contentStyle: {
            backgroundColor: '#12141a',
          },
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#12141a',
          statusBarTranslucent: false,
        }}
      />

      <Stack.Screen
        name="pdf-reader"
        options={{
          animation: 'none',
          contentStyle: {
            backgroundColor: '#12141a',
          },
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#12141a',
          statusBarTranslucent: false,
        }}
      />

      <Stack.Screen
        name="teacher-dashboard"
        options={{
          animation: 'none',
          contentStyle: {
            backgroundColor: '#12141a',
          },
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#12141a',
          statusBarTranslucent: false,
        }}
      />

    </Stack>
  );
}