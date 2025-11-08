#!/usr/bin/env python3
"""
Career Guidance Mobile App Backend API Tests
Tests all backend endpoints according to the review request
"""

import requests
import json
import time
from typing import Dict, Any, Optional

class CareerAppAPITester:
    def __init__(self, base_url: str = "https://careerbuddy-3.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api"
        self.auth_token = None
        self.test_user_email = "sarah.johnson@example.com"
        self.test_user_password = "SecurePass123!"
        self.test_user_name = "Sarah Johnson"
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, message: str, response_data: Any = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "response_data": response_data,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if response_data and not success:
            print(f"   Response: {response_data}")
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None, 
                    use_auth: bool = False) -> tuple[bool, Any]:
        """Make HTTP request with error handling"""
        url = f"{self.api_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if use_auth and self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, params=params, timeout=30)
            else:
                return False, f"Unsupported method: {method}"
            
            # Check if response is successful
            if response.status_code in [200, 201]:
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                try:
                    error_data = response.json()
                except:
                    error_data = response.text
                return False, f"HTTP {response.status_code}: {error_data}"
                
        except requests.exceptions.Timeout:
            return False, "Request timeout (30s)"
        except requests.exceptions.ConnectionError:
            return False, "Connection error - backend may be down"
        except Exception as e:
            return False, f"Request error: {str(e)}"
    
    def test_auth_signup(self) -> bool:
        """Test user signup"""
        print("\n🔐 Testing Authentication - Signup")
        
        signup_data = {
            "email": self.test_user_email,
            "password": self.test_user_password,
            "name": self.test_user_name
        }
        
        success, response = self.make_request("POST", "/auth/signup", signup_data)
        
        if success and isinstance(response, dict) and "access_token" in response:
            self.auth_token = response["access_token"]
            self.log_result("Auth Signup", True, "User created successfully and token received")
            return True
        else:
            # If user already exists, try login instead
            if "already registered" in str(response).lower():
                self.log_result("Auth Signup", True, "User already exists (expected), will use login")
                return self.test_auth_login()
            else:
                self.log_result("Auth Signup", False, "Failed to create user or get token", response)
                return False
    
    def test_auth_login(self) -> bool:
        """Test user login"""
        print("\n🔑 Testing Authentication - Login")
        
        login_data = {
            "email": self.test_user_email,
            "password": self.test_user_password
        }
        
        success, response = self.make_request("POST", "/auth/login", login_data)
        
        if success and isinstance(response, dict) and "access_token" in response:
            self.auth_token = response["access_token"]
            self.log_result("Auth Login", True, "Login successful and token received")
            return True
        else:
            self.log_result("Auth Login", False, "Failed to login or get token", response)
            return False
    
    def test_auth_me(self) -> bool:
        """Test get current user info"""
        print("\n👤 Testing Authentication - Get Me")
        
        if not self.auth_token:
            self.log_result("Auth Me", False, "No auth token available")
            return False
        
        success, response = self.make_request("GET", "/auth/me", use_auth=True)
        
        if success and isinstance(response, dict) and "email" in response:
            expected_email = self.test_user_email
            if response["email"] == expected_email:
                self.log_result("Auth Me", True, f"User info retrieved correctly: {response['name']}")
                return True
            else:
                self.log_result("Auth Me", False, f"Email mismatch: expected {expected_email}, got {response['email']}")
                return False
        else:
            self.log_result("Auth Me", False, "Failed to get user info", response)
            return False
    
    def test_ai_chat(self) -> bool:
        """Test AI chat functionality"""
        print("\n🤖 Testing AI Chat")
        
        if not self.auth_token:
            self.log_result("AI Chat", False, "No auth token available")
            return False
        
        chat_data = {
            "message": "I'm interested in transitioning from economics to AI. What are some good first steps and projects I should consider?",
            "chat_type": "text"
        }
        
        success, response = self.make_request("POST", "/chat/ai", chat_data, use_auth=True)
        
        if success and isinstance(response, dict) and "response" in response:
            ai_response = response["response"]
            if len(ai_response) > 50:  # Reasonable response length
                self.log_result("AI Chat", True, f"AI responded with {len(ai_response)} characters")
                return True
            else:
                self.log_result("AI Chat", False, f"AI response too short: {ai_response}")
                return False
        else:
            self.log_result("AI Chat", False, "Failed to get AI response", response)
            return False
    
    def test_chat_history(self) -> bool:
        """Test chat history retrieval"""
        print("\n📜 Testing Chat History")
        
        if not self.auth_token:
            self.log_result("Chat History", False, "No auth token available")
            return False
        
        success, response = self.make_request("GET", "/chat/history", use_auth=True)
        
        if success and isinstance(response, list):
            self.log_result("Chat History", True, f"Retrieved {len(response)} chat entries")
            return True
        else:
            self.log_result("Chat History", False, "Failed to get chat history", response)
            return False
    
    def test_seed_profiles(self) -> bool:
        """Test creating mock profiles"""
        print("\n🌱 Testing Seed Profiles")
        
        success, response = self.make_request("POST", "/seed/profiles")
        
        if success and isinstance(response, dict) and "message" in response:
            self.log_result("Seed Profiles", True, response["message"])
            return True
        else:
            self.log_result("Seed Profiles", False, "Failed to seed profiles", response)
            return False
    
    def test_get_profiles(self) -> bool:
        """Test getting unswiped profiles"""
        print("\n👥 Testing Get Profiles")
        
        if not self.auth_token:
            self.log_result("Get Profiles", False, "No auth token available")
            return False
        
        success, response = self.make_request("GET", "/profiles", use_auth=True)
        
        if success and isinstance(response, list):
            if len(response) > 0:
                # Store first profile ID for swipe test
                self.first_profile_id = response[0].get("id")
                self.log_result("Get Profiles", True, f"Retrieved {len(response)} profiles")
                return True
            else:
                self.log_result("Get Profiles", True, "No profiles available (all swiped or none seeded)")
                return True
        else:
            self.log_result("Get Profiles", False, "Failed to get profiles", response)
            return False
    
    def test_swipe_profile(self) -> bool:
        """Test swiping right on a profile"""
        print("\n💖 Testing Profile Swipe")
        
        if not self.auth_token:
            self.log_result("Profile Swipe", False, "No auth token available")
            return False
        
        if not hasattr(self, 'first_profile_id') or not self.first_profile_id:
            self.log_result("Profile Swipe", False, "No profile ID available to swipe")
            return False
        
        swipe_data = {
            "profile_id": self.first_profile_id,
            "action": "like"
        }
        
        success, response = self.make_request("POST", "/profiles/swipe", swipe_data, use_auth=True)
        
        if success and isinstance(response, dict):
            if "matched" in response:
                if response["matched"]:
                    self.match_id = response.get("match_id")
                    self.log_result("Profile Swipe", True, f"Swiped and matched! Match ID: {self.match_id}")
                else:
                    self.log_result("Profile Swipe", True, "Swiped successfully (no match)")
                return True
            else:
                self.log_result("Profile Swipe", False, "Invalid swipe response format", response)
                return False
        else:
            self.log_result("Profile Swipe", False, "Failed to swipe profile", response)
            return False
    
    def test_get_matches(self) -> bool:
        """Test getting user matches"""
        print("\n💕 Testing Get Matches")
        
        if not self.auth_token:
            self.log_result("Get Matches", False, "No auth token available")
            return False
        
        success, response = self.make_request("GET", "/matches", use_auth=True)
        
        if success and isinstance(response, list):
            if len(response) > 0:
                # Store first match ID for messaging test
                self.test_match_id = response[0].get("match_id")
                self.log_result("Get Matches", True, f"Retrieved {len(response)} matches")
            else:
                self.log_result("Get Matches", True, "No matches found")
            return True
        else:
            self.log_result("Get Matches", False, "Failed to get matches", response)
            return False
    
    def test_send_message(self) -> bool:
        """Test sending a message to a match"""
        print("\n💬 Testing Send Message")
        
        if not self.auth_token:
            self.log_result("Send Message", False, "No auth token available")
            return False
        
        # Use match_id from swipe or get_matches
        match_id = getattr(self, 'match_id', None) or getattr(self, 'test_match_id', None)
        
        if not match_id:
            self.log_result("Send Message", False, "No match ID available to send message")
            return False
        
        message_content = "Hi! I saw your profile and would love to learn more about your career journey in AI. Could you share some advice for someone transitioning from economics?"
        
        success, response = self.make_request(
            "POST", 
            f"/messages/{match_id}", 
            params={"content": message_content}, 
            use_auth=True
        )
        
        if success and isinstance(response, dict) and "content" in response:
            self.log_result("Send Message", True, f"Message sent successfully to match {match_id}")
            return True
        else:
            self.log_result("Send Message", False, "Failed to send message", response)
            return False
    
    def test_get_messages(self) -> bool:
        """Test getting messages for a match"""
        print("\n📨 Testing Get Messages")
        
        if not self.auth_token:
            self.log_result("Get Messages", False, "No auth token available")
            return False
        
        # Use match_id from swipe or get_matches
        match_id = getattr(self, 'match_id', None) or getattr(self, 'test_match_id', None)
        
        if not match_id:
            self.log_result("Get Messages", False, "No match ID available to get messages")
            return False
        
        success, response = self.make_request("GET", f"/messages/{match_id}", use_auth=True)
        
        if success and isinstance(response, list):
            self.log_result("Get Messages", True, f"Retrieved {len(response)} messages for match {match_id}")
            return True
        else:
            self.log_result("Get Messages", False, "Failed to get messages", response)
            return False
    
    def run_all_tests(self):
        """Run all API tests in sequence"""
        print("🚀 Starting Career Guidance App Backend API Tests")
        print(f"🌐 Testing against: {self.api_url}")
        print("=" * 60)
        
        # Test sequence as specified in review request
        tests = [
            ("Authentication - Signup", self.test_auth_signup),
            ("Authentication - Login", self.test_auth_login),
            ("Authentication - Get Me", self.test_auth_me),
            ("AI Chat", self.test_ai_chat),
            ("Chat History", self.test_chat_history),
            ("Seed Profiles", self.test_seed_profiles),
            ("Get Profiles", self.test_get_profiles),
            ("Profile Swipe", self.test_swipe_profile),
            ("Get Matches", self.test_get_matches),
            ("Send Message", self.test_send_message),
            ("Get Messages", self.test_get_messages)
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
                time.sleep(1)  # Brief pause between tests
            except Exception as e:
                self.log_result(test_name, False, f"Test exception: {str(e)}")
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"✅ Passed: {passed}/{total}")
        print(f"❌ Failed: {total - passed}/{total}")
        
        if passed == total:
            print("🎉 All tests passed!")
        else:
            print("⚠️  Some tests failed. Check details above.")
        
        # Detailed results
        print("\n📋 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        return passed, total

if __name__ == "__main__":
    tester = CareerAppAPITester()
    passed, total = tester.run_all_tests()
    
    # Exit with appropriate code
    exit(0 if passed == total else 1)