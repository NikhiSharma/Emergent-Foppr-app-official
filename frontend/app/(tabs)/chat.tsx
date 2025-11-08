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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hi! How can I help you today? I can guide you on career paths, projects, certifications, or connect you with mentors!',
      isAI: true,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingObj, setRecordingObj] = useState<Audio.Recording | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    setupAudio();
  }, []);

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
      
      // For MVP, we'll just show a message that voice is recorded
      // In production, you would transcribe this and send to AI
      Alert.alert('Voice recorded', 'Voice feature coming soon! Please use text for now.');
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const handleQuickOption = (option: typeof QUICK_OPTIONS[0]) => {
    sendMessage(`I'm interested in ${option.text.toLowerCase()}. Can you help me?`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Career Guide</Text>
        <TouchableOpacity onPress={() => Speech.speak('How can I help you today?')}>
          <Ionicons name="volume-high" size={24} color="#4A90E2" />
        </TouchableOpacity>
      </View>

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

      <View style={styles.quickOptions}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {QUICK_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.quickOption}
              onPress={() => handleQuickOption(option)}
            >
              <Ionicons name={option.icon as any} size={20} color="#4A90E2" />
              <Text style={styles.quickOptionText}>{option.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

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
  quickOptions: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  quickOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  quickOptionText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '500',
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
