#pragma once
#include <crow.h>
namespace pluggo { void registerCustomerApi(crow::SimpleApp& app); crow::response customerReadiness(); }
