cmake_minimum_required(VERSION 3.9.0)
project(NitroSslManager)

set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Define the shared C++ library. The name MUST match `androidCxxLibName`
# ("NitroSslManager") from nitro.json so System.loadLibrary("NitroSslManager")
# in the generated NitroSslManagerOnLoad.kt resolves it.
add_library(
  NitroSslManager
  SHARED
  # JNI entry point that registers all NitroSslManager HybridObjects.
  cpp-adapter.cpp
)

# Add all Nitrogen-generated sources, headers, definitions, and link libraries.
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NitroSslManager+autolinking.cmake)

# Link the Android system log library so fbjni/Nitro logging works.
find_library(LOG_LIB log)
target_link_libraries(
  NitroSslManager
  ${LOG_LIB}
)
