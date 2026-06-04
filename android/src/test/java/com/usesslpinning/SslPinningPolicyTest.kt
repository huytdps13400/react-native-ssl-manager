package com.usesslpinning

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * JVM unit tests for the certificate-rotation graceful-degradation policy (#4).
 * These exercise the pure decision logic and date handling without org.json or
 * the Android framework, so they run on `:react-native-ssl-manager:testDebugUnitTest`.
 */
class SslPinningPolicyTest {

    @Test
    fun enforcedByDefault() {
        assertTrue(SslPinningPolicy.shouldEnforce(enforcePinning = true, expiration = null))
    }

    @Test
    fun monitorModeDisablesEnforcement() {
        assertFalse(SslPinningPolicy.shouldEnforce(enforcePinning = false, expiration = null))
    }

    @Test
    fun expiredConfigFailsOpen() {
        assertFalse(SslPinningPolicy.shouldEnforce(enforcePinning = true, expiration = "2000-01-01"))
    }

    @Test
    fun futureExpirationStillEnforced() {
        assertTrue(SslPinningPolicy.shouldEnforce(enforcePinning = true, expiration = "2999-12-31"))
    }

    @Test
    fun malformedExpirationTreatedAsNotExpired() {
        // A date we cannot parse must not silently disable pinning.
        assertTrue(SslPinningPolicy.shouldEnforce(enforcePinning = true, expiration = "not-a-date"))
    }

    @Test
    fun monitorModeWinsOverFutureExpiration() {
        assertFalse(SslPinningPolicy.shouldEnforce(enforcePinning = false, expiration = "2999-12-31"))
    }

    @Test
    fun isExpiredPastDate() {
        assertTrue(SslPinningPolicy.isExpired("2000-01-01"))
    }

    @Test
    fun isExpiredFutureDate() {
        assertFalse(SslPinningPolicy.isExpired("2999-12-31"))
    }

    @Test
    fun isExpiredMalformedDate() {
        assertFalse(SslPinningPolicy.isExpired("garbage"))
    }
}
