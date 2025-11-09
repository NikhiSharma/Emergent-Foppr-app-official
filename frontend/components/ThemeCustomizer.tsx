import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, gradientColors, getThemeColors, GradientTheme, ThemeMode } from '../store/themeStore';
import { LinearGradient } from 'expo-linear-gradient';

interface ThemeCustomizerProps {
  visible: boolean;
  onClose: () => void;
}

export default function ThemeCustomizer({ visible, onClose }: ThemeCustomizerProps) {
  const { mode, gradient, setMode, setGradient } = useThemeStore();
  const colors = getThemeColors(mode);

  const gradientOptions: { key: GradientTheme; name: string; colors: string[] }[] = [
    { key: 'default', name: 'Ocean Blue', colors: gradientColors.default },
    { key: 'purple', name: 'Purple Haze', colors: gradientColors.purple },
    { key: 'green', name: 'Emerald', colors: gradientColors.green },
    { key: 'orange', name: 'Sunset', colors: gradientColors.orange },
    { key: 'pink', name: 'Rose', colors: gradientColors.pink },
    { key: 'blue', name: 'Sky Blue', colors: gradientColors.blue },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Customize Theme</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView}>
            {/* Theme Mode Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Theme Mode</Text>
              <View style={styles.modeContainer}>
                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    mode === 'light' && styles.modeButtonActive,
                  ]}
                  onPress={() => setMode('light')}
                >
                  <Ionicons 
                    name="sunny" 
                    size={32} 
                    color={mode === 'light' ? gradientColors[gradient][0] : colors.textSecondary} 
                  />
                  <Text style={[
                    styles.modeText, 
                    { color: mode === 'light' ? colors.text : colors.textSecondary }
                  ]}>
                    Light
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    mode === 'dark' && styles.modeButtonActive,
                  ]}
                  onPress={() => setMode('dark')}
                >
                  <Ionicons 
                    name="moon" 
                    size={32} 
                    color={mode === 'dark' ? gradientColors[gradient][0] : colors.textSecondary} 
                  />
                  <Text style={[
                    styles.modeText,
                    { color: mode === 'dark' ? colors.text : colors.textSecondary }
                  ]}>
                    Dark
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Gradient Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Accent Gradient</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                Choose your accent color theme
              </Text>
              <View style={styles.gradientGrid}>
                {gradientOptions.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.gradientOption,
                      { borderColor: colors.border },
                      gradient === option.key && { borderColor: option.colors[0], borderWidth: 3 },
                    ]}
                    onPress={() => setGradient(option.key)}
                  >
                    <LinearGradient
                      colors={option.colors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.gradientPreview}
                    >
                      {gradient === option.key && (
                        <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                      )}
                    </LinearGradient>
                    <Text style={[styles.gradientName, { color: colors.text }]}>
                      {option.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Preview Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Preview</Text>
              <View style={[styles.previewCard, { backgroundColor: colors.surface }]}>
                <LinearGradient
                  colors={gradientColors[gradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.previewGradient}
                >
                  <Ionicons name="star" size={32} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[styles.previewText, { color: colors.text }]}>
                  Your theme will look like this
                </Text>
                <Text style={[styles.previewSubtext, { color: colors.textSecondary }]}>
                  {mode === 'light' ? 'Light mode' : 'Dark mode'} with {gradientOptions.find(g => g.key === gradient)?.name} gradient
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    paddingHorizontal: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  modeContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
  },
  modeButtonActive: {
    borderWidth: 3,
  },
  modeText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  gradientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gradientOption: {
    width: '30%',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    padding: 8,
  },
  gradientPreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientName: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  previewCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  previewGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  previewText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
