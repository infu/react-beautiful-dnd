// @flow
import React from 'react';
import { getRect } from 'css-box-model';
import { mount, type ReactWrapper } from 'enzyme';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '../../../src';
import { getComputedSpacing } from '../../utils/dimension';
import { withKeyboard } from '../../utils/user-input-util';
import * as keyCodes from '../../../src/view/key-codes';
import type { Provided as DraggableProvided } from '../../../src/view/draggable/draggable-types';
import type { Provided as DroppableProvided } from '../../../src/view/droppable/droppable-types';

const pressSpacebar = withKeyboard(keyCodes.space);
const pressArrowDown = withKeyboard(keyCodes.arrowDown);

const reorder = (list: any[], startIndex: number, endIndex: number): any[] => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

type Task = {|
  id: string,
  onRender: Function,
  setRef: Function,
|};

type TaskItemProps = {|
  task: Task,
  provided: DraggableProvided,
|};

class TaskItem extends React.Component<TaskItemProps> {
  render() {
    const task: Task = this.props.task;
    task.onRender();
    const provided: DraggableProvided = this.props.provided;
    return (
      <div
        className="drag-handle"
        ref={ref => {
          task.setRef(ref);
          provided.innerRef(ref);
        }}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
      >
        <h4>{task.id}</h4>
      </div>
    );
  }
}

type InnerListProps = {|
  tasks: Task[],
|};

class InnerList extends React.Component<InnerListProps> {
  shouldComponentUpdate(props: InnerListProps) {
    if (this.props.tasks === props.tasks) {
      return false;
    }
    return true;
  }
  render() {
    return this.props.tasks.map((task: Task, index: number) => (
      <Draggable draggableId={task.id} index={index} key={task.id}>
        {(draggableProvided: DraggableProvided) => (
          <TaskItem task={task} provided={draggableProvided} />
        )}
      </Draggable>
    ));
  }
}

// Stubbing out totally - not including margins in this
jest
  .spyOn(window, 'getComputedStyle')
  .mockImplementation(() => getComputedSpacing({}));

const setDroppableBounds = (ref: ?HTMLElement) => {
  if (!ref) {
    return;
  }
  // $FlowFixMe - only reliable way to do this
  ref.getBoundingClientRect = () =>
    getRect({
      top: 0,
      left: 0,
      right: 100,
      bottom: 300,
    });
};
type State = {|
  tasks: Task[],
|};

const first: Task = {
  id: 'first',
  onRender: jest.fn(),
  setRef: (ref: ?HTMLElement) => {
    if (!ref) {
      return;
    }
    // $FlowFixMe - only reliable way to do this
    ref.getBoundingClientRect = () =>
      getRect({
        top: 0,
        left: 0,
        right: 100,
        bottom: 20,
      });
  },
};

const second: Task = {
  id: 'second',
  onRender: jest.fn(),
  setRef: (ref: ?HTMLElement) => {
    if (!ref) {
      return;
    }
    // $FlowFixMe - only reliable way to do this
    ref.getBoundingClientRect = () =>
      getRect({
        top: 30,
        left: 0,
        right: 100,
        bottom: 50,
      });
  },
};

const initial: Task[] = [first, second];

class App extends React.Component<*, State> {
  state: State = {
    tasks: initial,
  };

  onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }
    this.setState({
      tasks: reorder(
        this.state.tasks,
        result.source.index,
        result.destination.index,
      ),
    });
  };

  render() {
    return (
      <DragDropContext onDragEnd={this.onDragEnd}>
        <Droppable droppableId="droppable">
          {(droppableProvided: DroppableProvided) => (
            <div
              ref={ref => {
                setDroppableBounds(ref);
                droppableProvided.innerRef(ref);
              }}
              {...droppableProvided.droppableProps}
            >
              <InnerList tasks={this.state.tasks} />
              {droppableProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  }
}

it('should call the onBeforeDragStart before connected components are updated, and onDragStart after', () => {
  jest.useFakeTimers();
  const clearRenderMocks = () => {
    first.onRender.mockClear();
    second.onRender.mockClear();
  };

  const wrapper: ReactWrapper = mount(<App />);

  // clearing the initial render before a drag
  expect(first.onRender).toHaveBeenCalledTimes(1);
  expect(second.onRender).toHaveBeenCalledTimes(1);
  clearRenderMocks();

  // start a drag
  pressSpacebar(wrapper.find('.drag-handle').first());
  // flushing onDragStart
  jest.runOnlyPendingTimers();

  // initial lift will render the first item
  expect(first.onRender).toHaveBeenCalledTimes(1);
  expect(second.onRender).toHaveBeenCalledTimes(0);
  clearRenderMocks();

  pressArrowDown(wrapper.find('.drag-handle').first());
  // flushing keyboard movement
  requestAnimationFrame.step();

  // item1: moving down
  // item2: moving up
  expect(first.onRender).toHaveBeenCalledTimes(1);
  expect(second.onRender).toHaveBeenCalledTimes(1);
  clearRenderMocks();

  // drop (there is no animation because already in the home spot)
  pressSpacebar(wrapper.find('.drag-handle').first());

  // only a single render for the reorder and connected component update
  expect(first.onRender).toHaveBeenCalledTimes(1);
  expect(second.onRender).toHaveBeenCalledTimes(1);

  // checking for no post renders
  clearRenderMocks();
  requestAnimationFrame.flush();
  jest.runAllTimers();
  expect(first.onRender).toHaveBeenCalledTimes(0);
  expect(second.onRender).toHaveBeenCalledTimes(0);

  wrapper.unmount();
});
