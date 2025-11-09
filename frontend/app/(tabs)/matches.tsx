import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useThemeStore, getThemeColors, gradientColors } from '../../store/themeStore';
import { useFocusEffect } from '@react-navigation/native';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Match {
  match_id: string;
  profile: {
    id: string;
    name: string;
    bio: string;
    career: string;
    university: string;
    field: string;
    image: string;
  };
}

export default function Matches() {
  const router = useRouter();
  const { mode, gradient, loadTheme } = useThemeStore();
  const colors = getThemeColors(mode);
  const accentColor = gradientColors[gradient][0];

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  // Refresh matches every time the tab is focused
  useFocusEffect(
    React.useCallback(() => {
      fetchMatches();
    }, [])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchMatches();
    setRefreshing(false);
  }, []);

  const fetchMatches = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/api/matches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMatches(response.data);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const openChat = (match: Match) => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: match.match_id,
        name: match.profile.name,
        image: match.profile.image,
      },
    });
  };

  const renderMatch = ({ item }: { item: Match }) => (
    <TouchableOpacity
      style={[styles.matchCard, { backgroundColor: colors.surface }]}
      onPress={() => openChat(item)}
    >
      <Image source={{ uri: item.profile.image }} style={styles.matchImage} />
      <View style={styles.matchInfo}>
        <Text style={[styles.matchName, { color: colors.text }]}>{item.profile.name}</Text>
        <Text style={[styles.matchField, { color: accentColor }]}>{item.profile.field}</Text>
        <Text style={[styles.matchCareer, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.profile.career}
        </Text>
      </View>
      <View style={styles.chatButton}>
        <Ionicons name="chatbubble" size={24} color={accentColor} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Your Matches</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Loading matches...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Your Matches</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{matches.length} mentors</Text>
      </View>

      {matches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-dislike" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.text }]}>No matches yet</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Start swiping in Discover to find mentors!
          </Text>
          <TouchableOpacity
            style={[styles.discoverButton, { backgroundColor: accentColor }]}
            onPress={() => router.push('/(tabs)/discover')}
          >
            <Text style={styles.discoverButtonText}>Discover Mentors</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={matches}
          renderItem={renderMatch}
          keyExtractor={(item) => item.match_id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={accentColor}
              colors={[accentColor]}
            />
          }
        />
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
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  matchCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  matchImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#333',
  },
  matchInfo: {
    flex: 1,
    marginLeft: 16,
  },
  matchName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  matchField: {
    fontSize: 14,
    marginBottom: 4,
  },
  matchCareer: {
    fontSize: 13,
  },
  chatButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  discoverButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    marginTop: 24,
  },
  discoverButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
