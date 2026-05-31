import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VisualBoard from '../VisualBoard';

describe('VisualBoard Component', () => {
  it('renders null when visualCode is not provided', () => {
    const { container } = render(<VisualBoard visualCode={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders iframe when visualCode is provided', () => {
    const mockVisual = {
      title: 'गति और त्वरण (Speed and Acceleration)',
      html: '<div class="canvas-container"><canvas id="myCanvas"></canvas></div>',
      js: 'console.log("Animation Loaded");'
    };

    render(<VisualBoard visualCode={mockVisual} />);
    
    const iframe = screen.getByTitle('Dynamic Blackboard');
    expect(iframe).not.toBeNull();
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.getAttribute('srcDoc')).toContain('Animation Loaded');
    expect(iframe.getAttribute('srcDoc')).toContain('.canvas-container');
    expect(iframe.getAttribute('srcDoc')).toContain('.controls-panel');
  });
});
