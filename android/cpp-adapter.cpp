#include <jni.h>
#include <fbjni/fbjni.h>

#include "NitroSslManagerOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    // Register all NitroSslManager HybridObjects with the Nitro registry.
    margelo::nitro::sslmanager::registerAllNatives();
  });
}
