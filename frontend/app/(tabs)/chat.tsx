import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Message {
  id: string;
  text: string;
  isAI: boolean;
  timestamp: Date;
}

const CAREER_OPTIONS = [
  { 
    id: 1, 
    title: 'Video Sources', 
    icon: 'videocam',
    description: 'Learn through curated video content',
    color: '#FF6B6B'
  },
  { 
    id: 2, 
    title: 'Certifications', 
    icon: 'school',
    description: 'Explore courses and certifications',
    color: '#4ECDC4'
  },
  { 
    id: 3, 
    title: 'Project Ideas', 
    icon: 'bulb',
    description: 'Get beginner-friendly project suggestions',
    color: '#FFE66D'
  },
  { 
    id: 4, 
    title: 'Meet Mentors', 
    icon: 'people',
    description: 'Connect with professionals in your field',
    color: '#95E1D3'
  },
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingObj, setRecordingObj] = useState<Audio.Recording | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [userName, setUserName] = useState('');
  const [showCareerOptions, setShowCareerOptions] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    setupAudio();
    fetchUserName();
  }, []);

  const fetchUserName = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Extract first name from full name
      const firstName = response.data.name.split(' ')[0];
      setUserName(firstName);
    } catch (error) {
      console.error('Error fetching user name:', error);
      setUserName('there');
    }
  };

  const setupAudio = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Failed to setup audio:', error);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      isAI: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);
    setShowWelcome(false);

    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await axios.post(
        `${API_URL}/api/chat/ai`,
        { message: text, chat_type: 'text' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.data.response,
        isAI: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      
      // Check if the message is career-related
      const careerKeywords = ['career', 'job', 'work', 'project', 'certification', 'course', 'mentor', 'skill', 'learning', 'education', 'profession', 'business', 'startup'];
      const isCareerRelated = careerKeywords.some(keyword => 
        text.toLowerCase().includes(keyword) || response.data.response.toLowerCase().includes(keyword)
      );
      
      if (isCareerRelated && messages.length === 0) {
        setShowCareerOptions(true);
      }
      
      // Optional: Speak the response
      // Speech.speak(response.data.response);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission required', 'Please allow microphone access');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      
      setRecording(true);
      setRecordingObj(recording);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recordingObj) return;

    try {
      await recordingObj.stopAndUnloadAsync();
      const uri = recordingObj.getURI();
      setRecording(false);
      setRecordingObj(null);

      if (!uri) {
        Alert.alert('Error', 'Failed to record audio');
        return;
      }

      // Show alert about voice feature
      Alert.alert(
        'Voice Feature Coming Soon',
        'Voice transcription will be available soon! For now, please use the text input below to share your thoughts.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Please use text input for now.');
    }
  };

  const handleQuickOption = (option: typeof CAREER_OPTIONS[0]) => {
    setShowWelcome(false);
    sendMessage(`I'm interested in ${option.title.toLowerCase()}. Can you help me?`);
  };

  const renderWelcomeScreen = () => (
    <View style={styles.welcomeContainer}>
      <View style={styles.greetingSection}>
        <Text style={styles.greetingText}>
          How is your day going{userName ? ` ${userName}` : ''}?
        </Text>
        
        <View style={styles.inputOptionsContainer}>
          <TouchableOpacity 
            style={styles.voiceInputButton}
            onPress={recording ? stopRecording : startRecording}
          >
            <Ionicons 
              name={recording ? 'stop-circle' : 'mic'} 
              size={48} 
              color={recording ? '#E91E63' : '#4A90E2'} 
            />
            <Text style={styles.voiceInputText}>
              {recording ? 'Tap to stop' : 'Tap to speak'}
            </Text>
          </TouchableOpacity>

          <View style={styles.orTextContainer}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          <Text style={styles.typePrompt}>Type how you're feeling</Text>
        </View>
      </View>

      {showCareerOptions && (
        <ScrollView style={styles.optionsScrollView}>
          <Text style={styles.optionsTitle}>How can I help with your career?</Text>
          <View style={styles.optionsGrid}>
            {CAREER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[styles.optionCard, { borderLeftColor: option.color }]}
                onPress={() => handleQuickOption(option)}
              >
                <View style={[styles.optionIcon, { backgroundColor: option.color + '20' }]}>
                  <Ionicons name={option.icon as any} size={32} color={option.color} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );

  const renderChatScreen = () => (
    <>
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.isAI ? styles.aiMessage : styles.userMessage,
            ]}
          >
            <Text style={styles.messageText}>{message.text}</Text>
          </View>
        ))}
        {loading && (
          <View style={[styles.messageBubble, styles.aiMessage]}>
            <ActivityIndicator color="#4A90E2" />
          </View>
        )}
      </ScrollView>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Foppr</Text>
        <TouchableOpacity onPress={() => Speech.speak('How can I help you today?')}>
          <Ionicons name="volume-high" size={24} color="#4A90E2" />
        </TouchableOpacity>
      </View>

      {showWelcome && messages.length === 0 ? renderWelcomeScreen() : renderChatScreen()}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <TouchableOpacity
          style={styles.voiceButton}
          onPress={recording ? stopRecording : startRecording}
        >
          <Ionicons
            name={recording ? 'stop-circle' : 'mic'}
            size={24}
            color={recording ? '#E91E63' : '#4A90E2'}
          />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Ask me anything..."
          placeholderTextColor="#666"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />

        <TouchableOpacity
          style={styles.sendButton}
          onPress={() => sendMessage(inputText)}
          disabled={loading || !inputText.trim()}
        >
          <Ionicons name="send" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  welcomeContainer: {
    flex: 1,
    padding: 24,
  },
  greetingSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 40,
  },
  inputOptionsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  voiceInputButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  voiceInputText: {
    color: '#4A90E2',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
  orTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    width: '80%',
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  orText: {
    color: '#666',
    fontSize: 14,
    marginHorizontal: 16,
  },
  typePrompt: {
    color: '#999',
    fontSize: 16,
  },
  optionsScrollView: {
    maxHeight: '50%',
  },
  optionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  optionsGrid: {
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 16,
    gap: 16,
    borderLeftWidth: 4,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  optionDescription: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  aiMessage: {
    backgroundColor: '#1A1A1A',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  userMessage: {
    backgroundColor: '#4A90E2',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#0A0A0A',
  },
  voiceButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#4A90E2',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
