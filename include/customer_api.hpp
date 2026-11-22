#pragma once
#include <crow.h>
#include <optional>
namespace pluggo { void registerCustomerApi(crow::SimpleApp& app); crow::response customerReadiness(); crow::response customerOperatorStation();
// Empty when the caller may use operator routes; otherwise the 401/403/503 reply to send.
std::optional<crow::response> operatorDenied(const crow::request& request);
crow::response operatorAuthInfo(const crow::request& request); }
