# AgriSense Bi-LSTM Neural Engine: Mathematical & Theoretical Formulation

> **Document Version:** 1.2.0  
> **Project Name:** AgriSense Microclimate Monitoring & Plant Vitality Prediction System  
> **Target Specimen:** *Aloe barbadensis Miller* (Aloe Vera)  
> **Classification:** Technical Documentation / Mathematical Specification  

---

## 1. Problem Formulation & System Overview

The AgriSense AI Engine maps continuous multivariate environmental sensor telemetry to the physiological health and water dynamics of *Aloe barbadensis Miller*.

Given an ambient microclimate time-series observed at discrete hourly intervals $t \in \{1, 2, \dots, T\}$, the network models temporal dependencies across a 24-hour sliding window to forecast two target states:
1. **Vegetative Vitality Index** ($\hat{V}_t \in [0, 100\%]$)
2. **24-Hour Projected Soil Moisture** ($\hat{SM}_{t+24} \in [0, 100\%]$)

---

## 2. Input Space & Temporal Matrix Representation

### 2.1 Sensory Input Vector ($\mathbf{x}_t$)

At each hourly timestep $t$, the environmental state is represented by a $d$-dimensional vector ($d = 4$):

$$\mathbf{x}_t = \begin{bmatrix} T_t \\ RH_t \\ SM_t \\ L_t \end{bmatrix} \in \mathbb{R}^4$$

Where:
- $T_t \in \mathbb{R}$: Ambient Temperature in degrees Celsius ($^\circ\text{C}$).
- $RH_t \in [0, 100]$: Relative Humidity percentage ($\%$).
- $SM_t \in [0, 100]$: Volumetric Soil Moisture percentage ($\%$).
- $L_t \in \mathbb{R}_{\ge 0}$: Ambient Solar Irradiance / Light Intensity in lux ($\text{lx}$).

### 2.2 Feature Scaling (Min-Max Normalization)

To prevent features with larger numeric scales (e.g., Light in $[0, 65000\text{ lx}]$) from dominating gradient descent over smaller features (e.g., Temperature in $[15, 45^\circ\text{C}]$), Min-Max normalization scales all inputs to the closed interval $[0, 1]$:

$$\tilde{x}_{t, j} = \frac{x_{t, j} - \min_{k \in \mathcal{D}_{train}}(x_{k, j})}{\max_{k \in \mathcal{D}_{train}}(x_{k, j}) - \min_{k \in \mathcal{D}_{train}}(x_{k, j}) + \epsilon}$$

Where $\epsilon = 10^{-7}$ prevents division by zero. Parameters $\min$ and $\max$ are fitted strictly on the training partition $\mathcal{D}_{train}$ to eliminate data leakage.

### 2.3 Sliding Lookback Window Matrix ($\mathbf{X}_t$)

To capture full day-night diurnal CAM (Crassulacean Acid Metabolism) cycles, input vectors are grouped into rolling windows of length $W = 24$:

$$\mathbf{X}_{t} = \begin{bmatrix} \tilde{\mathbf{x}}_{t-23}^\top \\ \tilde{\mathbf{x}}_{t-22}^\top \\ \vdots \\ \tilde{\mathbf{x}}_{t}^\top \end{bmatrix} \in \mathbb{R}^{24 \times 4}$$

---

## 3. Bidirectional LSTM Neural Network Architecture

A standard unidirectional LSTM only processes temporal dependencies from past to present ($t-23 \to t$). In agricultural microclimates, thermal accumulation and nocturnal CAM water recovery are bidirectional; morning humidity is correlated with nocturnal dew formation, and afternoon soil drying depends on peak midday solar exposure.

The **Bidirectional LSTM (Bi-LSTM)** processes the sequence simultaneously in both temporal directions.

```
Input Sequence: X_t (24 timesteps, 4 features)
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ Layer 1: Bi-LSTM (64 hidden units, return_seq = True)  │
│ Forward: → 64 units  |  Backward: ← 64 units           │
│ Concatenated Output: 128 dimensions                    │
└────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ Layer 2: Bi-LSTM (32 hidden units, return_seq = False) │
│ Forward: → 32 units  |  Backward: ← 32 units           │
│ Last Timestep Concatenated: 64 dimensions              │
└────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ Dense Layer (32 units, ReLU activation)                │
└────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ Dropout Layer (p = 0.20 regularization)                │
└────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ Linear Output Layer (2 regression heads)               │
│ Output: [ Vitality Index (%), 24h Soil Moisture (%) ]  │
└────────────────────────────────────────────────────────┘
```

### 3.1 Mathematical Operations Inside an LSTM Unit

For each timestep $k \in \{1, \dots, W\}$, given normalized input $\tilde{\mathbf{x}}_k$ and prior hidden state $\mathbf{h}_{k-1} \in \mathbb{R}^h$:

#### 1. Forget Gate ($\mathbf{f}_k$)
Determines what fraction of the previous long-term cell state $\mathbf{c}_{k-1}$ to discard:

$$\mathbf{f}_k = \sigma\left(\mathbf{W}_f \tilde{\mathbf{x}}_k + \mathbf{U}_f \mathbf{h}_{k-1} + \mathbf{b}_f\right)$$

#### 2. Input Gate ($\mathbf{i}_k$)
Controls the extent to which newly computed memory candidates enter the cell state:

$$\mathbf{i}_k = \sigma\left(\mathbf{W}_i \tilde{\mathbf{x}}_k + \mathbf{U}_i \mathbf{h}_{k-1} + \mathbf{b}_i\right)$$

#### 3. Candidate Cell State ($\tilde{\mathbf{c}}_k$)
Computes modulated candidate values via hyperbolic tangent activation:

$$\tilde{\mathbf{c}}_k = \tanh\left(\mathbf{W}_c \tilde{\mathbf{x}}_k + \mathbf{U}_c \mathbf{h}_{k-1} + \mathbf{b}_c\right)$$

#### 4. Cell State Memory Conveyor ($\mathbf{c}_k$)
Updates the internal cell state through element-wise Hadamard multiplication ($\odot$):

$$\mathbf{c}_k = \mathbf{f}_k \odot \mathbf{c}_{k-1} + \mathbf{i}_k \odot \tilde{\mathbf{c}}_k$$

#### 5. Output Gate ($\mathbf{o}_k$)
Determines the filter applied to the cell state when generating the hidden state:

$$\mathbf{o}_k = \sigma\left(\mathbf{W}_o \tilde{\mathbf{x}}_k + \mathbf{U}_o \mathbf{h}_{k-1} + \mathbf{b}_o\right)$$

#### 6. Hidden State Vector ($\mathbf{h}_k$)
The short-term memory vector emitted at step $k$:

$$\mathbf{h}_k = \mathbf{o}_k \odot \tanh(\mathbf{c}_k)$$

Where:
- $\sigma(z) = \frac{1}{1 + e^{-z}}$ (Sigmoid non-linearity, mapping to $(0, 1)$).
- $\tanh(z) = \frac{e^z - e^{-z}}{e^z + e^{-z}}$ (Hyperbolic tangent, mapping to $(-1, 1)$).

---

### 3.2 Bidirectional Layer Stacking & Concatenation

For bidirectional layer $l$:
- **Forward Sequence ($\overrightarrow{\mathbf{h}}_k^{(l)}$):**
  $$\overrightarrow{\mathbf{h}}_k^{(l)} = \text{LSTM}_{fwd}^{(l)}\left(\mathbf{h}_k^{(l-1)}, \overrightarrow{\mathbf{h}}_{k-1}^{(l)}\right), \quad k = 1, 2, \dots, W$$
- **Backward Sequence ($\overleftarrow{\mathbf{h}}_k^{(l)}$):**
  $$\overleftarrow{\mathbf{h}}_k^{(l)} = \text{LSTM}_{bwd}^{(l)}\left(\mathbf{h}_k^{(l-1)}, \overleftarrow{\mathbf{h}}_{k+1}^{(l)}\right), \quad k = W, W-1, \dots, 1$$
- **Concatenated Hidden Representation ($\mathbf{H}_k^{(l)}$):**
  $$\mathbf{H}_k^{(l)} = \left[ \overrightarrow{\mathbf{h}}_k^{(l)} \,\|\, \overleftarrow{\mathbf{h}}_k^{(l)} \right] \in \mathbb{R}^{2 \cdot h^{(l)}}$$

**Layer Dimension Summary:**
- **Layer 1:** $h^{(1)} = 64$ units $\implies \mathbf{H}_{1:24}^{(1)} \in \mathbb{R}^{24 \times 128}$.
- **Layer 2:** $h^{(2)} = 32$ units $\implies \mathbf{H}_{24}^{(2)} \in \mathbb{R}^{64}$ (final sequence step).

---

### 3.3 Dense Regression Projection & Regularization

The final temporal representation $\mathbf{H}_{24}^{(2)}$ is projected through a fully connected dense layer with ReLU activation, followed by Dropout ($p = 0.20$):

$$\mathbf{z}_1 = \max\left(0, \mathbf{W}_{fc1} \mathbf{H}_{24}^{(2)} + \mathbf{b}_{fc1}\right) \in \mathbb{R}^{32}$$

$$\mathbf{z}_{drop} = \mathbf{z}_1 \odot \mathbf{m}, \quad m_j \sim \text{Bernoulli}(1 - p)$$

$$\hat{\mathbf{y}}_t = \mathbf{W}_{fc2} \mathbf{z}_{drop} + \mathbf{b}_{fc2} = \begin{bmatrix} \hat{V}_t \\ \hat{SM}_{t+24} \end{bmatrix} \in \mathbb{R}^2$$

---

### 3.4 Objective Function: Huber Loss (Smooth $L_1$)

The network is trained by minimizing the Huber loss function, balancing Mean Squared Error (for small errors) with Mean Absolute Error (for outliers caused by occasional sensor telemetry noise):

$$\mathcal{L}_\delta(y, \hat{y}) = \frac{1}{N} \sum_{i=1}^N \sum_{k=1}^2 \ell_\delta\left(y_{i, k} - \hat{y}_{i, k}\right)$$

$$\ell_\delta(e) = \begin{cases} \frac{1}{2} e^2, & \text{if } |e| \le \delta \\ \delta \cdot \left(|e| - \frac{1}{2}\delta\right), & \text{if } |e| > \delta \end{cases}$$

Where threshold $\delta = 1.0$. Optimization uses the Adam optimizer with learning rate $\eta = 0.001$, $\beta_1 = 0.9$, $\beta_2 = 0.999$, and batch size $B = 32$.

---

## 4. Microclimate Physics & Evapotranspiration Dynamics

In the 7-day microclimate projection and live simulation, soil drying and moisture depletion are modeled through thermodynamics and empirical soil physics.

### 4.1 Evapotranspiration Equation ($\Delta SM_t$)

The daily percentage soil moisture depletion $\Delta SM_t$ ($\%/\text{day}$) is modeled using a modified Hargreaves-Samani formulation adjusted for tropical pot environments:

$$\Delta SM_t = \text{BaseRate} \cdot \Gamma_{temp}(T_{max}) \cdot \Gamma_{pot} \cdot \Gamma_{sun} \cdot \Gamma_{soil} \cdot \Phi_{rain}(R_{rain}, \text{pop})$$

Where:
1. **Base Depletion Rate:** $\text{BaseRate} = 2.2\%$ daily moisture loss under reference conditions ($28^\circ\text{C}$, medium pot, loam).
2. **Temperature Multiplier ($\Gamma_{temp}$):**
   $$\Gamma_{temp}(T_{max}) = \max\left(0.70, \frac{T_{max}}{28.0}\right)$$
3. **Container Size Multiplier ($\Gamma_{pot}$):**
   $$\Gamma_{pot} = \begin{cases} 1.40, & \text{Small Pot / Polybag (Accelerated root-zone drying)} \\ 1.00, & \text{Medium Pot (Standard container)} \\ 0.75, & \text{Large Container / In-Ground substrate} \end{cases}$$
4. **Sunlight Exposure Multiplier ($\Gamma_{sun}$):**
   $$\Gamma_{sun} = \begin{cases} 1.30, & \text{Full Direct Midday Sun} \\ 1.00, & \text{Morning Sun + Midday Shade (Optimal)} \\ 0.75, & \text{50\% Shade Net Greenhouse} \end{cases}$$
5. **Soil Substrate Drainage Multiplier ($\Gamma_{soil}$):**
   $$\Gamma_{soil} = \begin{cases} 1.25, & \text{Fast Draining (Cactus/Succulent Perlite Mix)} \\ 1.00, & \text{Standard Garden Loam} \\ 0.85, & \text{Clay Loam} \end{cases}$$
6. **Atmospheric Evaporation Damping Factor ($\Phi_{rain}$):**
   $$\Phi_{rain} = \begin{cases} 0.10, & \text{if } R_{rain} \ge 8.0\text{ mm (Soaking tropical rainfall)} \\ 0.40, & \text{if } 3.0\text{ mm} \le R_{rain} < 8.0\text{ mm (Moderate rain)} \\ 0.75, & \text{if } R_{rain} < 3.0\text{ mm and } \text{pop} \ge 0.60\text{ (Overcast cloud cover)} \\ 1.00, & \text{otherwise (Dry clear conditions)} \end{cases}$$

---

### 4.2 Soil Moisture Continuity & Water Infiltration

Soil moisture progression across day $t \to t+1$ is governed by:

$$SM_{t+1} = \max\Big(4.0\%, \min\big(50.0\%, SM_t + G_{rain}(R_{rain}) - \Delta SM_t\big)\Big)$$

Where water infiltration gain $G_{rain}(R_{rain})$ is categorized as:

$$G_{rain}(R_{rain}) = \begin{cases} \min(30\%, R_{rain} \cdot 1.8), & \text{for } R_{rain} \ge 8.0\text{ mm} \\ \min(6\%, R_{rain} \cdot 0.8), & \text{for } 3.0\text{ mm} \le R_{rain} < 8.0\text{ mm} \\ 0\%, & \text{for } R_{rain} < 3.0\text{ mm (Surface evaporation only)} \end{cases}$$

---

### 4.3 Drought Counter State Machine ($D_{unwatered}$)

The integer drought counter $D \in \mathbb{N}_0$ tracks days elapsed since the root zone was thoroughly soaked:

$$D_{t+1} = \begin{cases} 0, & \text{if } R_{rain} \ge 8.0\text{ mm or Manual Irrigation Triggered} \\ D_t + 1, & \text{if } R_{rain} < 8.0\text{ mm} \end{cases}$$

---

## 5. Aloe Vera Physiological Health & CAM Modeling

*Aloe barbadensis Miller* utilizes **Crassulacean Acid Metabolism (CAM)**. The mathematical model reflects its specialized diurnal respiration and water storage adaptations.

### 5.1 Photoperiod Stomatal Gating

To minimize transpirational water loss during hot daylight hours, stomata remain closed when solar irradiance exceeds the threshold:

$$\text{Stomata}(L_t) = \begin{cases} \text{Closed (Daytime Transpiration Conservation)}, & \text{if } L_t > 1000\text{ lx} \\ \text{Open (Nocturnal } \text{CO}_2 \text{ Uptake \& Malic Acid Fixation)}, & \text{if } L_t \le 1000\text{ lx} \end{cases}$$

---

### 5.2 Vegetative Vitality Index Formulation ($V$)

The Vitality Index $V(t) \in [20, 99]$ is calculated by subtracting empirical stress penalties from the baseline healthy state ($V_0 = 96.5\%$):

$$V(t) = \text{clamp}_{[20, 99]}\left(V_0 - \mathcal{P}_{soil}(SM) - \mathcal{P}_{temp}(T) - \mathcal{P}_{humid}(RH) - \mathcal{P}_{drought}(D)\right)$$

Where the penalty functions are defined as:

1. **Soil Moisture Stress Penalty ($\mathcal{P}_{soil}$):**
   $$\mathcal{P}_{soil}(SM) = \begin{cases} (20 - SM) \cdot 2.1, & \text{if } SM < 20\% \text{ (Drought root desiccation)} \\ (SM - 42) \cdot 1.6, & \text{if } SM > 42\% \text{ (Root rot / anaerobic risk)} \\ 0, & \text{if } 20\% \le SM \le 42\% \text{ (Optimal succulent range)} \end{cases}$$

2. **Thermal Stress Penalty ($\mathcal{P}_{temp}$):**
   $$\mathcal{P}_{temp}(T) = \begin{cases} (T - 32) \cdot 2.4, & \text{if } T > 32^\circ\text{C (Heat stress, leaf scorch)} \\ (22 - T) \cdot 1.7, & \text{if } T < 22^\circ\text{C (Cold arrest)} \\ 0, & \text{if } 22^\circ\text{C} \le T \le 32^\circ\text{C (Optimal)} \end{cases}$$

3. **Vapor Pressure Deficit Penalty ($\mathcal{P}_{humid}$):**
   $$\mathcal{P}_{humid}(RH) = \begin{cases} (35 - RH) \cdot 0.40, & \text{if } RH < 35\% \text{ (Desiccating dry air)} \\ (RH - 75) \cdot 0.30, & \text{if } RH > 75\% \text{ (High pathogen risk)} \\ 0, & \text{if } 35\% \le RH \le 75\% \end{cases}$$

4. **Drought Accumulation Penalty ($\mathcal{P}_{drought}$):**
   $$\mathcal{P}_{drought}(D) = \begin{cases} 0, & \text{if } D \le 8\text{ days (Normal dry interval)} \\ (D - 8) \cdot 1.80, & \text{if } D > 8\text{ days (Delayed irrigation stress)} \end{cases}$$

---

### 5.3 Leaf Turgor Pressure ($P_{turgor}$)

Leaf gel plumpness correlates directly with internal hydrostatic cell turgidity:

$$P_{turgor}(t) = \text{clamp}_{[30, 98]}\left(95.0 - 1.4 \cdot \mathcal{P}_{soil}(SM) - 1.2 \cdot D\right)$$

- **$P_{turgor} \ge 80\%$:** Plump, firm, and fully hydrated succulent leaves.
- **$P_{turgor} < 65\%$:** Thinning, softer texture, and visible leaf shrinkage.

---

## 6. Model Evaluation & Benchmark Metrics

The predictive performance of the Bi-LSTM model was evaluated on an out-of-sample test partition consisting of $n = 288$ consecutive hourly observations ($20\%$ of the 60-day dataset).

### 6.1 Mean Absolute Error (MAE)

$$\text{MAE} = \frac{1}{n} \sum_{i=1}^n \left| y_i - \hat{y}_i \right|$$

- **Vitality Index MAE:** $\mathbf{0.7144\%}$ (under $1\%$ average error)
- **Soil Moisture MAE:** $\mathbf{0.3626\%}$ (under $0.4\%$ average error)

### 6.2 Mean Squared Error (MSE)

$$\text{MSE} = \frac{1}{n} \sum_{i=1}^n \left( y_i - \hat{y}_i \right)^2$$

- **Vitality Index MSE:** $\mathbf{0.7783}$
- **Soil Moisture MSE:** $\mathbf{0.2119}$

### 6.3 Root Mean Squared Error (RMSE)

$$\text{RMSE} = \sqrt{\text{MSE}} = \sqrt{\frac{1}{n} \sum_{i=1}^n \left( y_i - \hat{y}_i \right)^2}$$

- **Vitality Index RMSE:** $\mathbf{0.8822\%}$
- **Soil Moisture RMSE:** $\mathbf{0.4603\%}$

### 6.4 Coefficient of Determination ($R^2$ Score)

Measures the proportion of variance in actual biological observations explained by model predictions relative to a baseline mean predictor $\bar{y}$:

$$R^2 = 1 - \frac{\text{SS}_{res}}{\text{SS}_{tot}} = 1 - \frac{\sum_{i=1}^n (y_i - \hat{y}_i)^2}{\sum_{i=1}^n (y_i - \bar{y})^2}$$

- **Vitality Index $R^2$:** $\mathbf{0.8875} \implies \mathbf{88.75\%}$
- **Soil Moisture $R^2$:** $\mathbf{0.9868} \implies \mathbf{98.68\%}$

### 6.5 Mean Absolute Percentage Error (MAPE)

$$\text{MAPE} = \frac{100\%}{n} \sum_{i=1}^n \left| \frac{y_i - \hat{y}_i}{y_i + \epsilon} \right|$$

- **Vitality Index MAPE:** $\mathbf{0.78\%}$ (Model reliability: $99.22\%$)
- **Soil Moisture MAPE:** $\mathbf{1.16\%}$ (Model reliability: $98.84\%$)

---

## 7. Official Benchmark Summary Table

| Metric / Parameter | Notation | Target Variable | Benchmark Result | Target Acceptance | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Coefficient of Determination** | $R^2$ | Plant Vitality | **$88.75\%$** | $> 85.0\%$ | Pass (High Fit) |
| **Coefficient of Determination** | $R^2$ | Soil Moisture | **$98.68\%$** | $> 90.0\%$ | Pass (Near Perfect) |
| **Mean Absolute Error** | MAE | Plant Vitality | **$0.7144\%$** | $< 2.50\%$ | Pass (Optimal) |
| **Mean Absolute Error** | MAE | Soil Moisture | **$0.3626\%$** | $< 2.00\%$ | Pass (Optimal) |
| **Root Mean Squared Error** | RMSE | Plant Vitality | **$0.8822\%$** | $< 3.00\%$ | Pass (Optimal) |
| **Root Mean Squared Error** | RMSE | Soil Moisture | **$0.4603\%$** | $< 3.00\%$ | Pass (Optimal) |
| **Mean Absolute Pct Error** | MAPE | Plant Vitality | **$0.78\%$** | $< 5.00\%$ | Pass (Optimal) |
| **Mean Absolute Pct Error** | MAPE | Soil Moisture | **$1.16\%$** | $< 5.00\%$ | Pass (Optimal) |
| **Model Parameters** | $|\Theta|$ | Full Architecture | **$78,690$** | $< 100,000$ | Pass (Edge Fit) |
| **Lookback Sequence** | $W$ | Input Matrix | **$24\text{ hours}$** | $24\text{ hours}$ | Pass (Diurnal) |

