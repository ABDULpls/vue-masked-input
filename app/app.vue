<template>
    model: {{ model }}
    <MaskedInput v-model="model" :mask="mask"/>

    <div style="margin-top: 16px">
        mask:
        <input v-model="mask" type="text" />
    </div>
</template>
<script setup>
import MaskedInput from '../components/MaskedInput.vue';

const model = ref('');
const mask = ref('+7 000 000-00-00')
</script>
<style>
body, input {
  font-family: sans-serif;
  font-size: 14px;
  font-weight: 300;
  letter-spacing: normal;
  box-sizing: border-box;
}
</style>
