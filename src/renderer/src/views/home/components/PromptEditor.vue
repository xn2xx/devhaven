<template>
  <div class="prompt-editor">
    <!-- 参数定义 -->
    <div class="section">
      <h4 class="section-title">
        <i class="i-fa-solid:cogs mr-2"></i>
        参数定义
      </h4>
      <div class="arguments-list">
        <div v-for="(arg, index) in localArguments" :key="index" class="argument-item">
          <div class="argument-fields">
            <el-input
              v-model="arg.name"
              placeholder="参数名称"
              class="argument-name"
              @input="updateArguments"
            >
              <template #prepend>名称</template>
            </el-input>
            <el-input
              v-model="arg.description"
              placeholder="参数描述"
              class="argument-description"
              @input="updateArguments"
            >
              <template #prepend>描述</template>
            </el-input>
            <el-switch
              v-model="arg.required"
              active-text="必需"
              inactive-text="可选"
              @change="updateArguments"
            />
            <el-button
              type="danger"
              size="small"
              @click="removeArgument(index)"
            >
              <i class="i-fa-solid:trash"></i>
            </el-button>
          </div>
        </div>
        <el-button @click="addArgument" class="add-argument-btn">
          <i class="i-fa-solid:plus mr-2"></i>
          添加参数
        </el-button>
      </div>
    </div>

    <!-- 消息模板 -->
    <div class="section">
      <h4 class="section-title">
        <i class="i-fa-solid:comments mr-2"></i>
        消息模板
      </h4>
      <div class="messages-list">
        <div v-for="(message, index) in localMessages" :key="index" class="message-item">
          <div class="message-header">
            <el-select v-model="message.role" @change="updateMessages" class="role-select">
              <el-option label="用户" value="user" />
              <el-option label="助手" value="assistant" />
              <!-- <el-option label="系统" value="system" /> -->
            </el-select>
            <el-button
              type="danger"
              size="small"
              @click="removeMessage(index)"
              :disabled="localMessages.length <= 1"
            >
              <i class="i-fa-solid:trash"></i>
            </el-button>
          </div>
          <el-input
            v-model="message.content.text"
            type="textarea"
            :rows="6"
            placeholder="输入消息内容，可以使用 {{参数名}} 来引用参数"
            @input="updateMessages"
          />
          <div class="message-variables" v-if="localArguments.length > 0">
            <span class="variables-label">可用变量：</span>
            <el-tag
              v-for="arg in localArguments"
              :key="arg.name"
              size="small"
              class="variable-tag"
              @click="insertVariable(index, arg.name)"
            >
              {{arg.name}}
            </el-tag>
          </div>
        </div>
        <!-- 暂时不支持添加消息 -->
        <!-- <el-button @click="addMessage" class="add-message-btn">
          <i class="i-fa-solid:plus mr-2"></i>
          添加消息
        </el-button> -->
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  arguments: {
    type: Array,
    default: () => []
  },
  messages: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:arguments', 'update:messages']);

const localArguments = ref([...props.arguments]);
const localMessages = ref([...props.messages]);

// 监听 props 变化
watch(() => props.arguments, (newVal) => {
  localArguments.value = [...newVal];
}, { deep: true });

watch(() => props.messages, (newVal) => {
  localMessages.value = [...newVal];
}, { deep: true });

// 参数管理
const addArgument = () => {
  localArguments.value.push({
    name: '',
    description: '',
    required: true
  });
  updateArguments();
};

const removeArgument = (index) => {
  localArguments.value.splice(index, 1);
  updateArguments();
};

const updateArguments = () => {
  emit('update:arguments', [...localArguments.value]);
};

// 消息管理
const addMessage = () => {
  localMessages.value.push({
    role: 'user',
    content: {
      type: 'text',
      text: ''
    }
  });
  updateMessages();
};

const removeMessage = (index) => {
  localMessages.value.splice(index, 1);
  updateMessages();
};

const updateMessages = () => {
  emit('update:messages', [...localMessages.value]);
};

// 插入变量
const insertVariable = (messageIndex, variableName) => {
  const message = localMessages.value[messageIndex];
  const cursorPos = message.content.text.length;
  const before = message.content.text.substring(0, cursorPos);
  const after = message.content.text.substring(cursorPos);
  message.content.text = before + `{{${variableName}}}` + after;
  updateMessages();
};
</script>

<style scoped>
.prompt-editor {
  padding: 16px;
}

.section {
  margin-bottom: 24px;
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-color);
  display: flex;
  align-items: center;
}

.arguments-list {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
}

.argument-item {
  margin-bottom: 12px;
}

.argument-fields {
  display: flex;
  gap: 12px;
  align-items: center;
}

.argument-name {
  flex: 1;
}

.argument-description {
  flex: 2;
}

.add-argument-btn {
  width: 100%;
  margin-top: 8px;
}

.messages-list {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
}

.message-item {
  margin-bottom: 16px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 12px;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.role-select {
  width: 120px;
}

.message-variables {
  margin-top: 8px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.variables-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.variable-tag {
  cursor: pointer;
  transition: background-color 0.2s;
}

.variable-tag:hover {
  background-color: var(--primary-color);
  color: white;
}

.add-message-btn {
  width: 100%;
  margin-top: 8px;
}

.yaml-preview {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
}

.yaml-preview :deep(.el-textarea__inner) {
  background-color: #f8f9fa;
  color: #333;
  border: 1px solid var(--border-color);
}
</style>
