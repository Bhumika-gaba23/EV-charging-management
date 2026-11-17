#pragma once
// Outbound integrations for the customer API: Firebase phone sign-in and Razorpay payments.
// Both are optional and switched on by environment variables; without them the API keeps
// its anonymous-visitor and zero-amount behaviour.
#include <cstdint>
#include <map>
#include <mutex>
#include <stdexcept>
#include <string>
#include <vector>

namespace pluggo {

struct HttpReply {
    long status = 0;
    std::string body;
    std::string cacheControl;
};

// HTTPS request through libcurl. Throws std::runtime_error on transport failure.
HttpReply httpRequest(const std::string& method, const std::string& url, const std::string& body,
                      const std::vector<std::string>& headers, const std::string& userPassword = "");

std::string hmacSha256Hex(const std::string& key, const std::string& data);
bool constantTimeEquals(const std::string& a, const std::string& b);
std::string base64UrlDecode(const std::string& input);

struct FirebaseUser {
    std::string uid;
    std::string phone;
};

// Verifies Firebase Authentication ID tokens (RS256 JWTs) against Google's rotating
// public certificates, following Firebase's "verify ID tokens using a third-party JWT
// library" rules: alg, kid, signature, aud, iss, exp, iat, auth_time and sub.
class FirebaseVerifier {
public:
    FirebaseVerifier();
    bool enabled() const { return !projectId_.empty(); }
    const std::string& projectId() const { return projectId_; }
    FirebaseUser verify(const std::string& token);  // throws std::runtime_error

private:
    std::string certificateFor(const std::string& kid);
    std::string projectId_;
    std::string certsUrl_;
    std::mutex mutex_;
    std::map<std::string, std::string> certs_;
    std::int64_t certsExpireAt_ = 0;
};

// Razorpay Orders API + payment signature verification (test or live keys).
class Razorpay {
public:
    Razorpay();
    bool enabled() const { return !keyId_.empty() && !secret_.empty(); }
    const std::string& keyId() const { return keyId_; }
    std::string createOrder(std::int64_t amountPaise, const std::string& receipt);  // throws
    bool verifySignature(const std::string& orderId, const std::string& paymentId,
                         const std::string& signature) const;

private:
    std::string keyId_;
    std::string secret_;
    std::string apiBase_;
};

void initIntegrations();

}  // namespace pluggo
