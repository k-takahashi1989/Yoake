const EventType = {
  DISMISSED: 0,
  PRESS: 1,
  ACTION_PRESS: 2,
  DELIVERED: 3,
  APP_BLOCKED: 4,
  CHANNEL_BLOCKED: 5,
  CHANNEL_GROUP_BLOCKED: 6,
  TRIGGER_NOTIFICATION_CREATED: 7,
  FG_ALREADY_EXIST: 8,
  UNKNOWN: -1,
};

const TriggerType = {
  TIMESTAMP: 0,
  INTERVAL: 1,
};

const AndroidImportance = {
  NONE: 0,
  MIN: 1,
  LOW: 2,
  DEFAULT: 3,
  HIGH: 4,
};

const notifee = {
  requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
  createChannel: jest.fn().mockResolvedValue('channel-id'),
  createTriggerNotification: jest.fn().mockResolvedValue('notification-id'),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
  cancelAllNotifications: jest.fn().mockResolvedValue(undefined),
  getTriggerNotifications: jest.fn().mockResolvedValue([]),
  onForegroundEvent: jest.fn(() => jest.fn()),
  onBackgroundEvent: jest.fn(),
  displayNotification: jest.fn().mockResolvedValue('notification-id'),
  getInitialNotification: jest.fn().mockResolvedValue(null),
};

module.exports = notifee;
module.exports.default = notifee;
module.exports.EventType = EventType;
module.exports.TriggerType = TriggerType;
module.exports.AndroidImportance = AndroidImportance;
