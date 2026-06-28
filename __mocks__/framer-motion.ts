jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    img: ({ children, ...props }: any) => <img {...props}>{children}</img>,
    // Add other motion.* components if used in the future
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));