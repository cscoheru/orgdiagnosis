/**
 * Compatibility shim for strategy decoding components.
 *
 * The strategydecoding project uses `useStore` from `@/lib/store`.
 * This module re-exports the strategy store adapter so that
 * migrated components work without modification.
 */

export { useStrategyStore as useStore, StrategyStoreProvider } from '@/components/strategy/StrategyContext';
