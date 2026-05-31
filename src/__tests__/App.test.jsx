import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

// Mock audio helper classes
vi.mock('../utils/AudioPlayer', () => {
  return {
    AudioPlayer: vi.fn().mockImplementation(() => {
      return {
        init: vi.fn(),
        playChunk: vi.fn(),
        stop: vi.fn(),
        close: vi.fn(),
      };
    }),
  };
});

vi.mock('../utils/AudioRecorder', () => {
  return {
    AudioRecorder: vi.fn().mockImplementation(() => {
      return {
        start: vi.fn(),
        stop: vi.fn(),
      };
    }),
  };
});

// Mock AudioContext
class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = 'suspended';
    this.destination = {};
  }
  resume = vi.fn();
  close = vi.fn();
}

const mockTutors = [
  {
    id: "tutor_1",
    name: "Bhoutik AI",
    instructions: "Physics tutor instructions",
    lessonPlan: ["Introduction to gravity", "Quiz"],
    dialect: "awadhi",
    pace: "normal",
    subject: "Physics",
    board: "UP Board"
  }
];

const mockStudents = [
  {
    id: "student_1",
    name: "Vikas Yadav",
    assignedTutorId: "tutor_1",
    gaps: ["gravity calculation error"],
    strengths: ["inertia theory"],
    quizScore: 85,
    diagnostics: "Excellent progress.",
    currentStepIndex: 0,
    dialect: "awadhi",
    pace: "normal",
    lessonPlan: ["Introduction to gravity", "Quiz"]
  }
];

const mockStateResponse = {
  tutors: mockTutors,
  students: mockStudents,
  apiKey: "dummy-key-123"
};

describe('Main App Component Routing and Flows', () => {
  let originalFetch;
  let originalAudioContext;
  let originalWebSocket;

  beforeEach(() => {
    // Reset location pathname to root before each test to clean history state
    window.history.replaceState(null, "", "/");

    // Mock scrollIntoView which is missing in jsdom
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    // Mock Fetch
    originalFetch = window.fetch;
    window.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/state')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStateResponse),
        });
      }
      if (url.includes('/api/student-detail')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            student: mockStudents[0],
            tutor: mockTutors[0],
            apiKey: "dummy-key-123"
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, students: mockStudents, tutors: mockTutors }),
      });
    });

    // Mock AudioContext
    originalAudioContext = window.AudioContext;
    window.AudioContext = MockAudioContext;

    // Mock WebSocket
    originalWebSocket = window.WebSocket;
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 1; // OPEN
      }
      send = vi.fn();
      close = vi.fn();
    }
    window.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    window.fetch = originalFetch;
    window.AudioContext = originalAudioContext;
    window.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  it('renders landing page with portal options', () => {
    render(<App />);
    expect(screen.getByText('📚 UP Regional AI Vernacular Tutor')).toBeDefined();
    expect(screen.getByText('Coordinator Portal')).toBeDefined();
    expect(screen.getByText('Student Classroom')).toBeDefined();
  });

  it('navigates to Coordinator Portal and renders registers & templates', async () => {
    render(<App />);
    
    // Click Coordinator Portal button
    const coordBtn = screen.getByText('Enter Admin Hub →');
    fireEvent.click(coordBtn);

    // Verify Coordinator view header is present
    await waitFor(() => {
      expect(screen.getByText(/🏫 Coordinator Hub:/)).toBeDefined();
    });

    // Verify state details loaded by switching tabs
    const tutorsNavBtn = screen.getByText('👨‍🏫 Manage Tutors');
    fireEvent.click(tutorsNavBtn);
    await waitFor(() => {
      expect(screen.getAllByText('Bhoutik AI').length).toBeGreaterThan(0);
    });

    const studentsNavBtn = screen.getByText('👥 Student Roster');
    fireEvent.click(studentsNavBtn);
    await waitFor(() => {
      expect(screen.getAllByText('Vikas Yadav').length).toBeGreaterThan(0);
    });
  });

  it('navigates to Student Portal selector and enters student classroom', async () => {
    render(<App />);
    
    // Click Student Portal button
    const studentBtn = screen.getByText('Start Learning →');
    fireEvent.click(studentBtn);

    // Verify Selector view is present
    await waitFor(() => {
      expect(screen.getByText('🎓 UP Vernacular Student Classroom Gate')).toBeDefined();
    });

    // Click student selector card
    const studentCard = screen.getByText('Vikas Yadav');
    fireEvent.click(studentCard);

    // Verify entering Classroom
    await waitFor(() => {
      expect(screen.getByText('🎓 Vernacular Student Classroom')).toBeDefined();
    });
  });

  it('supports tabs switching in the student portal', async () => {
    render(<App />);
    
    // Go to student portal directly
    fireEvent.click(screen.getByText('Start Learning →'));
    await waitFor(() => expect(screen.getByText('Vikas Yadav')).toBeDefined());
    fireEvent.click(screen.getByText('Vikas Yadav'));

    await waitFor(() => {
      expect(screen.getByText('📈 View Progress')).toBeDefined();
    });

    // Click Analytics tab
    const analyticsTabBtn = screen.getByText('📈 View Progress');
    fireEvent.click(analyticsTabBtn);

    // Verify analytics components loaded
    await waitFor(() => {
      expect(screen.getByText('🟢 Mastered Strengths')).toBeDefined();
      expect(screen.getByText('🔴 Learning Gaps')).toBeDefined();
      expect(screen.getByText('💡 Personalized AI Recommendations')).toBeDefined();
    });
  });
});
