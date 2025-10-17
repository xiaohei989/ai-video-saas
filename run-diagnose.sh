#!/bin/bash

# 读取.env文件
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
elif [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# 执行诊断脚本
node diagnose-thumbnail-issue.mjs
