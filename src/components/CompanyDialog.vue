<template>
  <el-dialog
    v-model="dialogVisible"
    title="Add Company"
    width="500px"
  >
    <el-form
      ref="companyForm"
      :model="companyData"
      :rules="companyRules"
      label-position="top"
    >
      <el-form-item label="Company Name" prop="name">
        <el-input v-model="companyData.name" placeholder="Enter company name" />
      </el-form-item>

      <el-form-item label="Description" prop="description">
        <el-input
          v-model="companyData.description"
          type="textarea"
          rows="3"
          placeholder="Enter company description"
        />
      </el-form-item>

      <el-form-item label="Icon" prop="icon">
        <el-select v-model="companyData.icon" placeholder="Select icon">
          <el-option label="Building" value="building" />
          <el-option label="Company" value="building-columns" />
          <el-option label="Organization" value="sitemap" />
          <el-option label="Business" value="briefcase" />
          <el-option label="Code" value="code" />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="cancelDialog">Cancel</el-button>
        <el-button type="primary" @click="submitForm">Create</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  visible: Boolean,
  companyData: Object
});

const emit = defineEmits(['update:visible', 'save']);

const dialogVisible = ref(props.visible);
const companyForm = ref(null);
const companyData = ref({
  name: '',
  description: '',
  icon: 'building'
});

const companyRules = {
  name: [{ required: true, message: 'Please enter company name', trigger: 'blur' }]
};

// Watch for changes to the visible prop
watch(() => props.visible, (newValue) => {
  dialogVisible.value = newValue;
});

// Watch for changes to dialogVisible and emit update:visible
watch(dialogVisible, (newValue) => {
  emit('update:visible', newValue);
});

// When companyData prop changes, update the local copy
watch(() => props.companyData, (newData) => {
  if (newData) {
    companyData.value = { ...newData };
  } else {
    resetForm();
  }
});

const resetForm = () => {
  companyData.value = {
    name: '',
    description: '',
    icon: 'building'
  };
  if (companyForm.value) {
    companyForm.value.resetFields();
  }
};

const cancelDialog = () => {
  dialogVisible.value = false;
  resetForm();
};

const submitForm = async () => {
  if (!companyForm.value) return;

  await companyForm.value.validate((valid) => {
    if (valid) {
      emit('save', { ...companyData.value });
      dialogVisible.value = false;
      resetForm();
    }
  });
};
</script>
