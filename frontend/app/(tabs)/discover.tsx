import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useThemeStore, getThemeColors, gradientColors } from '../../store/themeStore';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

interface Profile {
  id: string;
  name: string;
  bio: string;
  career: string;
  university: string;
  field: string;
  image: string;
}

export default function Discover() {
  const router = useRouter();
  const { mode, gradient, loadTheme } = useThemeStore();
  const colors = getThemeColors(mode);
  const accentColor = gradientColors[gradient][0];

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const position = useRef(new Animated.ValueXY()).current;
  const [seededProfiles, setSeededProfiles] = useState(false);

  useEffect(() => {
    loadTheme();
    seedProfilesIfNeeded();
  }, []);

  useEffect(() => {
    if (seededProfiles) {
      fetchProfiles();
    }
  }, [seededProfiles]);

  const seedProfilesIfNeeded = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      // Call the new seed endpoint that creates test users
      await axios.post(
        `${API_URL}/api/seed/test-users`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSeededProfiles(true);
    } catch (error) {
      console.error('Seed error:', error);
      setSeededProfiles(true); // Continue anyway
    }
  };

  const fetchProfiles = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/api/profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfiles(response.data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gesture) => {
      position.setValue({ x: gesture.dx, y: gesture.dy });
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > SWIPE_THRESHOLD) {
        forceSwipe('right');
      } else if (gesture.dx < -SWIPE_THRESHOLD) {
        forceSwipe('left');
      } else {
        resetPosition();
      }
    },
  });

  const forceSwipe = (direction: 'left' | 'right') => {
    const x = direction === 'right' ? SCREEN_WIDTH + 100 : -SCREEN_WIDTH - 100;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => onSwipeComplete(direction));
  };

  const onSwipeComplete = async (direction: 'left' | 'right') => {
    const action = direction === 'right' ? 'like' : 'pass';
    const profile = profiles[currentIndex];

    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.post(
        `${API_URL}/api/profiles/swipe`,
        { profile_id: profile.id, action },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.matched) {
        Alert.alert(
          'It\'s a Match!',
          `You matched with ${profile.name}! You can now chat with them.`,
          [
            { text: 'Keep Swiping', style: 'cancel' },
            {
              text: 'Go to Matches',
              onPress: () => router.push('/(tabs)/matches'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Swipe error:', error);
    }

    position.setValue({ x: 0, y: 0 });
    setCurrentIndex(currentIndex + 1);
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  };

  const renderCard = () => {
    if (currentIndex >= profiles.length) {
      return (
        <View style={styles.noMoreCards}>
          <Ionicons name="checkmark-circle" size={80} color={accentColor} />
          <Text style={[styles.noMoreText, { color: colors.text }]}>No more profiles</Text>
          <Text style={[styles.noMoreSubtext, { color: colors.textSecondary }]}>Check back later for more peers!</Text>
        </View>
      );
    }

    const profile = profiles[currentIndex];
    const rotate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      outputRange: ['-10deg', '0deg', '10deg'],
      extrapolate: 'clamp',
    });

    const rotateAndTranslate = {
      transform: [
        { rotate },
        ...position.getTranslateTransform(),
      ],
    };

    return (
      <Animated.View
        key={profile.id}
        style={[styles.card, { backgroundColor: colors.surface }, rotateAndTranslate]}
        {...panResponder.panHandlers}
      >
        <Image source={{ uri: profile.image }} style={styles.cardImage} />
        <View style={styles.cardContent}>
          <Text style={[styles.cardName, { color: colors.text }]}>{profile.name}</Text>
          <Text style={[styles.cardField, { color: accentColor }]}>{profile.field}</Text>
          <Text style={[styles.cardCareer, { color: colors.text }]}>{profile.career}</Text>
          <Text style={[styles.cardUniversity, { color: colors.textSecondary }]}>{profile.university}</Text>
          <Text style={[styles.cardBio, { color: colors.textSecondary }]}>{profile.bio}</Text>
        </View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading profiles...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Discover Mentors</Text>
      </View>

      <View style={styles.cardContainer}>{renderCard()}</View>

      {currentIndex < profiles.length && (
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.passButton, { backgroundColor: colors.surface, borderColor: '#FF5722' }]}
            onPress={() => forceSwipe('left')}
          >
            <Ionicons name="close" size={32} color="#FF5722" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton, { backgroundColor: colors.surface, borderColor: accentColor }]}
            onPress={() => forceSwipe('right')}
          >
            <Ionicons name="heart" size={32} color={accentColor} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: SCREEN_WIDTH * 0.9,
    height: '80%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '40%',
    backgroundColor: '#333',
  },
  cardContent: {
    padding: 24,
    flex: 1,
  },
  cardName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardField: {
    fontSize: 16,
    marginBottom: 12,
  },
  cardCareer: {
    fontSize: 18,
    marginBottom: 8,
  },
  cardUniversity: {
    fontSize: 14,
    marginBottom: 16,
  },
  cardBio: {
    fontSize: 16,
    lineHeight: 24,
  },
  noMoreCards: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noMoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  noMoreSubtext: {
    fontSize: 16,
    marginTop: 8,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    paddingBottom: 32,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 2,
  },
  passButton: {},
  likeButton: {},
});
