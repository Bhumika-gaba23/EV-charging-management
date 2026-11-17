#include "integrations.hpp"

#include <crow.h>
#include <curl/curl.h>
#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <openssl/pem.h>
#include <openssl/x509.h>

#include <algorithm>
#include <cctype>
#include <chrono>
#include <cstdlib>
#include <memory>
#include <sstream>

namespace pluggo {
namespace {

std::string env(const char* key, const std::string& fallback = "") {
    const char* value = std::getenv(key);
    return value ? std::string(value) : fallback;
}

std::int64_t nowSeconds() {
    return std::chrono::duration_cast<std::chrono::seconds>(
               std::chrono::system_clock::now().time_since_epoch())
        .count();
}

std::size_t collectBody(char* data, std::size_t size, std::size_t count, void* target) {
    static_cast<std::string*>(target)->append(data, size * count);
    return size * count;
}

std::size_t collectHeader(char* data, std::size_t size, std::size_t count, void* target) {
    std::string line(data, size * count);
    std::string lower = line;
    std::transform(lower.begin(), lower.end(), lower.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (lower.rfind("cache-control:", 0) == 0) {
        auto value = line.substr(14);
        value.erase(0, value.find_first_not_of(" \t"));
        value.erase(value.find_last_not_of("\r\n \t") + 1);
        *static_cast<std::string*>(target) = value;
    }
    return size * count;
}

std::int64_t maxAge(const std::string& cacheControl) {
    const auto at = cacheControl.find("max-age=");
    if (at == std::string::npos) return 3600;
    try {
        return std::max<std::int64_t>(60, std::stoll(cacheControl.substr(at + 8)));
    } catch (...) {
        return 3600;
    }
}

std::string claimText(const crow::json::rvalue& claims, const char* key) {
    if (!claims.has(key) || claims[key].t() != crow::json::type::String) return "";
    return std::string(claims[key].s());
}

double claimNumber(const crow::json::rvalue& claims, const char* key) {
    if (!claims.has(key) || claims[key].t() != crow::json::type::Number)
        throw std::runtime_error(std::string("Sign-in token is missing ") + key);
    return claims[key].d();
}

}  // namespace

void initIntegrations() { curl_global_init(CURL_GLOBAL_DEFAULT); }

HttpReply httpRequest(const std::string& method, const std::string& url, const std::string& body,
                      const std::vector<std::string>& headers, const std::string& userPassword) {
    std::unique_ptr<CURL, decltype(&curl_easy_cleanup)> curl(curl_easy_init(), curl_easy_cleanup);
    if (!curl) throw std::runtime_error("Cannot create HTTP client");
    HttpReply reply;
    curl_slist* list = nullptr;
    for (const auto& header : headers) list = curl_slist_append(list, header.c_str());
    std::unique_ptr<curl_slist, decltype(&curl_slist_free_all)> guard(list, curl_slist_free_all);
    curl_easy_setopt(curl.get(), CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl.get(), CURLOPT_CUSTOMREQUEST, method.c_str());
    if (method != "GET") {
        curl_easy_setopt(curl.get(), CURLOPT_POSTFIELDS, body.c_str());
        curl_easy_setopt(curl.get(), CURLOPT_POSTFIELDSIZE, static_cast<long>(body.size()));
    }
    if (list) curl_easy_setopt(curl.get(), CURLOPT_HTTPHEADER, list);
    if (!userPassword.empty()) curl_easy_setopt(curl.get(), CURLOPT_USERPWD, userPassword.c_str());
    curl_easy_setopt(curl.get(), CURLOPT_TIMEOUT, 10L);
    curl_easy_setopt(curl.get(), CURLOPT_CONNECTTIMEOUT, 5L);
    curl_easy_setopt(curl.get(), CURLOPT_NOSIGNAL, 1L);
    curl_easy_setopt(curl.get(), CURLOPT_WRITEFUNCTION, collectBody);
    curl_easy_setopt(curl.get(), CURLOPT_WRITEDATA, &reply.body);
    curl_easy_setopt(curl.get(), CURLOPT_HEADERFUNCTION, collectHeader);
    curl_easy_setopt(curl.get(), CURLOPT_HEADERDATA, &reply.cacheControl);
    const auto code = curl_easy_perform(curl.get());
    if (code != CURLE_OK) throw std::runtime_error(std::string("HTTP request failed: ") + curl_easy_strerror(code));
    curl_easy_getinfo(curl.get(), CURLINFO_RESPONSE_CODE, &reply.status);
    return reply;
}

std::string hmacSha256Hex(const std::string& key, const std::string& data) {
    unsigned char digest[EVP_MAX_MD_SIZE];
    unsigned int length = 0;
    if (!HMAC(EVP_sha256(), key.data(), static_cast<int>(key.size()),
              reinterpret_cast<const unsigned char*>(data.data()), data.size(), digest, &length))
        throw std::runtime_error("HMAC failed");
    static const char* hex = "0123456789abcdef";
    std::string result;
    for (unsigned int i = 0; i < length; ++i) {
        result += hex[digest[i] >> 4];
        result += hex[digest[i] & 15];
    }
    return result;
}

bool constantTimeEquals(const std::string& a, const std::string& b) {
    if (a.size() != b.size()) return false;
    unsigned char difference = 0;
    for (std::size_t i = 0; i < a.size(); ++i)
        difference |= static_cast<unsigned char>(a[i] ^ b[i]);
    return difference == 0;
}

std::string base64UrlDecode(const std::string& input) {
    auto value = [](char c) -> int {
        if (c >= 'A' && c <= 'Z') return c - 'A';
        if (c >= 'a' && c <= 'z') return c - 'a' + 26;
        if (c >= '0' && c <= '9') return c - '0' + 52;
        if (c == '-' || c == '+') return 62;
        if (c == '_' || c == '/') return 63;
        return -1;
    };
    std::string output;
    int buffer = 0, bits = 0;
    for (char c : input) {
        if (c == '=') break;
        const int v = value(c);
        if (v < 0) throw std::runtime_error("Invalid base64url text");
        buffer = (buffer << 6) | v;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            output += static_cast<char>((buffer >> bits) & 0xFF);
        }
    }
    return output;
}

// ----------------------------------------------------------------------------- Firebase

FirebaseVerifier::FirebaseVerifier()
    : projectId_(env("PLUGGO_FIREBASE_PROJECT_ID")),
      certsUrl_(env("PLUGGO_FIREBASE_CERTS_URL",
                    "https://www.googleapis.com/robot/v1/metadata/x509/"
                    "securetoken@system.gserviceaccount.com")) {}

std::string FirebaseVerifier::certificateFor(const std::string& kid) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (nowSeconds() >= certsExpireAt_ || !certs_.count(kid)) {
        const auto reply = httpRequest("GET", certsUrl_, "", {});
        if (reply.status != 200) throw std::runtime_error("Cannot load sign-in certificates");
        const auto json = crow::json::load(reply.body);
        if (!json || json.t() != crow::json::type::Object)
            throw std::runtime_error("Invalid sign-in certificates");
        certs_.clear();
        for (const auto& item : json)
            if (item.t() == crow::json::type::String) certs_[item.key()] = std::string(item.s());
        certsExpireAt_ = nowSeconds() + maxAge(reply.cacheControl);
    }
    const auto found = certs_.find(kid);
    if (found == certs_.end()) throw std::runtime_error("Sign-in token key is not recognised");
    return found->second;
}

FirebaseUser FirebaseVerifier::verify(const std::string& token) {
    if (!enabled()) throw std::runtime_error("Phone sign-in is not configured");
    if (token.size() > 4096) throw std::runtime_error("Sign-in token is too large");
    const auto first = token.find('.');
    const auto second = first == std::string::npos ? first : token.find('.', first + 1);
    if (second == std::string::npos || token.find('.', second + 1) != std::string::npos)
        throw std::runtime_error("Malformed sign-in token");

    const auto header = crow::json::load(base64UrlDecode(token.substr(0, first)));
    const auto claims = crow::json::load(base64UrlDecode(token.substr(first + 1, second - first - 1)));
    const auto signature = base64UrlDecode(token.substr(second + 1));
    if (!header || !claims) throw std::runtime_error("Malformed sign-in token");
    if (claimText(header, "alg") != "RS256") throw std::runtime_error("Unexpected sign-in token algorithm");
    const auto kid = claimText(header, "kid");
    if (kid.empty()) throw std::runtime_error("Sign-in token has no key ID");

    const auto pem = certificateFor(kid);
    std::unique_ptr<BIO, decltype(&BIO_free)> bio(BIO_new_mem_buf(pem.data(), static_cast<int>(pem.size())), BIO_free);
    std::unique_ptr<X509, decltype(&X509_free)> cert(PEM_read_bio_X509(bio.get(), nullptr, nullptr, nullptr), X509_free);
    if (!cert) throw std::runtime_error("Invalid sign-in certificate");
    std::unique_ptr<EVP_PKEY, decltype(&EVP_PKEY_free)> key(X509_get_pubkey(cert.get()), EVP_PKEY_free);
    std::unique_ptr<EVP_MD_CTX, decltype(&EVP_MD_CTX_free)> ctx(EVP_MD_CTX_new(), EVP_MD_CTX_free);
    const std::string signedPart = token.substr(0, second);
    if (!key || !ctx || EVP_DigestVerifyInit(ctx.get(), nullptr, EVP_sha256(), nullptr, key.get()) != 1 ||
        EVP_DigestVerifyUpdate(ctx.get(), signedPart.data(), signedPart.size()) != 1 ||
        EVP_DigestVerifyFinal(ctx.get(), reinterpret_cast<const unsigned char*>(signature.data()),
                              signature.size()) != 1)
        throw std::runtime_error("Sign-in token signature is invalid");

    const double now = static_cast<double>(nowSeconds());
    if (claimText(claims, "aud") != projectId_) throw std::runtime_error("Sign-in token is for another project");
    if (claimText(claims, "iss") != "https://securetoken.google.com/" + projectId_)
        throw std::runtime_error("Sign-in token has the wrong issuer");
    if (claimNumber(claims, "exp") <= now) throw std::runtime_error("Sign-in has expired; please sign in again");
    if (claimNumber(claims, "iat") > now + 300) throw std::runtime_error("Sign-in token is not valid yet");
    if (claimNumber(claims, "auth_time") > now + 300) throw std::runtime_error("Sign-in token is not valid yet");
    FirebaseUser user{claimText(claims, "sub"), claimText(claims, "phone_number")};
    if (user.uid.empty() || user.uid.size() > 128) throw std::runtime_error("Sign-in token has no user");
    return user;
}

// ----------------------------------------------------------------------------- Razorpay

Razorpay::Razorpay()
    : keyId_(env("RAZORPAY_KEY_ID")),
      secret_(env("RAZORPAY_KEY_SECRET")),
      apiBase_(env("PLUGGO_RAZORPAY_API_BASE", "https://api.razorpay.com")) {}

std::string Razorpay::createOrder(std::int64_t amountPaise, const std::string& receipt) {
    crow::json::wvalue request;
    request["amount"] = amountPaise;
    request["currency"] = "INR";
    request["receipt"] = receipt.substr(0, 40);
    request["notes"]["session"] = receipt;
    const auto reply = httpRequest("POST", apiBase_ + "/v1/orders", request.dump(),
                                   {"Content-Type: application/json"}, keyId_ + ":" + secret_);
    const auto json = crow::json::load(reply.body);
    if (reply.status != 200 || !json || !json.has("id") || json["id"].t() != crow::json::type::String)
        throw std::runtime_error("Razorpay order request failed (HTTP " + std::to_string(reply.status) + ")");
    return std::string(json["id"].s());
}

bool Razorpay::verifySignature(const std::string& orderId, const std::string& paymentId,
                               const std::string& signature) const {
    if (!enabled() || orderId.empty() || paymentId.empty() || signature.size() != 64) return false;
    return constantTimeEquals(hmacSha256Hex(secret_, orderId + "|" + paymentId), signature);
}

}  // namespace pluggo
