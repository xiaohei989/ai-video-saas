/**
 * E-E-A-T 雷达图组件
 * 简化版实现（不依赖 Chart.js）
 */

import React from 'react'
import { Box, Typography, Card, CardContent, Chip } from '@mui/material'

interface EEATRadarChartProps {
  trust: number // 0-15
  authority: number // 0-10
  expertise: number // 0-10
  experience: number // 信息增益评分 0-10，映射为Experience维度
}

export const EEATRadarChart: React.FC<EEATRadarChartProps> = ({
  trust,
  authority,
  expertise,
  experience
}) => {
  // 归一化分数到 0-100
  const normalizedTrust = (trust / 15) * 100
  const normalizedAuthority = (authority / 10) * 100
  const normalizedExpertise = (expertise / 10) * 100
  const normalizedExperience = (experience / 10) * 100

  // 计算雷达图路径点
  const centerX = 100
  const centerY = 100
  const radius = 80

  const getPoint = (angle: number, value: number) => {
    const rad = (angle - 90) * (Math.PI / 180)
    const r = (value / 100) * radius
    return {
      x: centerX + r * Math.cos(rad),
      y: centerY + r * Math.sin(rad)
    }
  }

  // 四个维度的角度 (90度间隔)
  const trustPoint = getPoint(0, normalizedTrust)
  const authorityPoint = getPoint(90, normalizedAuthority)
  const experiencePoint = getPoint(180, normalizedExperience)
  const expertisePoint = getPoint(270, normalizedExpertise)

  // 生成雷达图路径
  const radarPath = `M ${trustPoint.x},${trustPoint.y}
                      L ${authorityPoint.x},${authorityPoint.y}
                      L ${experiencePoint.x},${experiencePoint.y}
                      L ${expertisePoint.x},${expertisePoint.y}
                      Z`

  // 生成网格路径（三层）
  const gridPaths = [25, 50, 75].map(percent => {
    const p1 = getPoint(0, percent)
    const p2 = getPoint(90, percent)
    const p3 = getPoint(180, percent)
    const p4 = getPoint(270, percent)
    return `M ${p1.x},${p1.y} L ${p2.x},${p2.y} L ${p3.x},${p3.y} L ${p4.x},${p4.y} Z`
  })

  // 生成坐标轴线
  const axisLines = [
    { x1: centerX, y1: centerY, x2: centerX, y2: centerY - radius }, // 上
    { x1: centerX, y1: centerY, x2: centerX + radius, y2: centerY }, // 右
    { x1: centerX, y1: centerY, x2: centerX, y2: centerY + radius }, // 下
    { x1: centerX, y1: centerY, x2: centerX - radius, y2: centerY }  // 左
  ]

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h6">🛡️ E-E-A-T 四维雷达图</Typography>
          <Chip label="Google 2025 标准" color="primary" size="small" />
        </Box>

        {/* SVG 雷达图 */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <svg width="240" height="240" viewBox="0 0 200 200">
            {/* 网格背景 */}
            {gridPaths.map((path, i) => (
              <path
                key={i}
                d={path}
                fill="none"
                stroke="#e0e0e0"
                strokeWidth="1"
              />
            ))}

            {/* 坐标轴线 */}
            {axisLines.map((line, i) => (
              <line
                key={i}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#bdbdbd"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
            ))}

            {/* 雷达数据区域 */}
            <path
              d={radarPath}
              fill="rgba(102, 126, 234, 0.3)"
              stroke="rgb(102, 126, 234)"
              strokeWidth="2"
            />

            {/* 数据点 */}
            <circle cx={trustPoint.x} cy={trustPoint.y} r="4" fill="rgb(102, 126, 234)" />
            <circle cx={authorityPoint.x} cy={authorityPoint.y} r="4" fill="rgb(102, 126, 234)" />
            <circle cx={experiencePoint.x} cy={experiencePoint.y} r="4" fill="rgb(102, 126, 234)" />
            <circle cx={expertisePoint.x} cy={expertisePoint.y} r="4" fill="rgb(102, 126, 234)" />

            {/* 标签 */}
            <text x={centerX} y={centerY - radius - 10} textAnchor="middle" fontSize="11" fill="#333">
              可信度
            </text>
            <text x={centerX + radius + 10} y={centerY + 5} textAnchor="start" fontSize="11" fill="#333">
              权威性
            </text>
            <text x={centerX} y={centerY + radius + 20} textAnchor="middle" fontSize="11" fill="#333">
              经验性
            </text>
            <text x={centerX - radius - 10} y={centerY + 5} textAnchor="end" fontSize="11" fill="#333">
              专业性
            </text>
          </svg>
        </Box>

        {/* 分数详情 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 12, height: 12, bgcolor: 'rgb(102, 126, 234)', borderRadius: '50%' }} />
            <Typography variant="body2">
              可信度: <strong>{trust}/15</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 12, height: 12, bgcolor: 'rgb(102, 126, 234)', borderRadius: '50%' }} />
            <Typography variant="body2">
              权威性: <strong>{authority}/10</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 12, height: 12, bgcolor: 'rgb(102, 126, 234)', borderRadius: '50%' }} />
            <Typography variant="body2">
              经验性: <strong>{experience}/10</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 12, height: 12, bgcolor: 'rgb(102, 126, 234)', borderRadius: '50%' }} />
            <Typography variant="body2">
              专业性: <strong>{expertise}/10</strong>
            </Typography>
          </Box>
        </Box>

        {/* 说明 */}
        <Box sx={{ mt: 2, p: 1, bgcolor: 'info.light', borderRadius: 1, opacity: 0.8 }}>
          <Typography variant="caption" color="info.dark">
            💡 经验性 (Experience) 是 Google 2023 年新增的 E-E-A-T 维度，强调第一手实践经验
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}
