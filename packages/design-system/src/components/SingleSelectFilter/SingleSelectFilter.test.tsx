import { render, screen, fireEvent } from '@testing-library/react';
import { SingleSelectFilter } from './SingleSelectFilter';

const options = [
  { value: 'all', label: 'All stages' },
  { value: 'build', label: 'Build' },
  { value: 'run', label: 'Run' },
];

describe('SingleSelectFilter', () => {
  it('shows the current value on the trigger', () => {
    render(
      <SingleSelectFilter
        label="Stage"
        options={options}
        value="build"
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByText('Stage: Build')).toBeInTheDocument();
  });

  it('falls back to "All" when the value has no matching option', () => {
    render(
      <SingleSelectFilter
        label="Stage"
        options={options}
        value="unknown"
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByText('Stage: All')).toBeInTheDocument();
  });

  it('calls onChange with the picked option', () => {
    const onChange = jest.fn();
    render(
      <SingleSelectFilter
        label="Stage"
        options={options}
        value="all"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /select stage/i }));
    fireEvent.click(screen.getByText('Run'));
    expect(onChange).toHaveBeenCalledWith('run');
  });

  it('disables the trigger when there are no options', () => {
    render(
      <SingleSelectFilter
        label="Stage"
        options={[]}
        value="all"
        onChange={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: /select stage/i }),
    ).toBeDisabled();
  });
});
