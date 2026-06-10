<template>
  <div class="gsap-page">
    <h1>Base64 图片展示</h1>
    <div class="image-grid">
      <div v-for="(img, idx) in images" :key="idx" class="image-card">
        <h3>{{ img.label }}</h3>
        <img :src="'data:image/png;base64,' + img.base64" :alt="img.label" />
      </div>
    </div>
  </div>
</template>

<script setup>
import images from './images.json'
</script>

<style scoped>
.gsap-page {
  padding: 20px;
}
.image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-top: 16px;
}
.image-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  max-width: 500px;
}
.image-card h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #333;
}
.image-card img {
  max-width: 100%;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
}
</style>
