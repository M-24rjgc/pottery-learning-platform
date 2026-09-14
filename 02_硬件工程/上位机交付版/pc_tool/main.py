#!/usr/bin/env python3
"""
陶瓷学习器 - PC 上位机
实时显示 5 路传感器数据曲线, 发送命令, 录制手势

依赖:
  pip install pyserial matplotlib

用法:
  python main.py
"""

import sys
import threading
import queue
import time
from collections import deque

import tkinter as tk
from tkinter import ttk, scrolledtext

import matplotlib
matplotlib.use('TkAgg')
from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("请先安装 pyserial: pip install pyserial")
    sys.exit(1)

# ======================== 配置 ========================

SENSOR_NAMES = ['拇指', '食指', '中指', '无名指', '小指']
SENSOR_COLORS = ['#E74C3C', '#E67E22', '#2ECC71', '#3498DB', '#9B59B6']
SENSOR_MIN = 500
SENSOR_MAX = 2500
WINDOW_SECS = 20       # 显示最近 20 秒
MAX_POINTS = 500       # 最多保存点数
POLL_MS = 50           # UI 刷新间隔 (ms)
BAUDRATE = 9600

# ======================== 串口读取线程 ========================

class SerialReader:
    """后台串口读取线程"""

    def __init__(self):
        self.ser = None
        self.running = False
        self.thread = None
        self.line_queue = queue.Queue()
        self.connected = False

    def connect(self, port):
        """连接串口"""
        try:
            self.ser = serial.Serial(
                port=port,
                baudrate=BAUDRATE,
                timeout=0.05,
                write_timeout=1
            )
            time.sleep(2)  # 等 Arduino 复位完成
            self.running = True
            self.connected = True
            self.thread = threading.Thread(target=self._read_loop, daemon=True)
            self.thread.start()
            return True
        except serial.SerialException as e:
            self.connected = False
            return str(e)

    def disconnect(self):
        """断开串口"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=1)
        if self.ser and self.ser.is_open:
            self.ser.close()
        self.connected = False

    def send(self, text):
        """发送命令"""
        if self.ser and self.ser.is_open:
            try:
                self.ser.write((text + '\n').encode('utf-8'))
                return True
            except serial.SerialException:
                return False
        return False

    def _read_loop(self):
        """后台循环读取"""
        while self.running and self.ser and self.ser.is_open:
            try:
                line = self.ser.readline()
                if line:
                    decoded = line.decode('utf-8', errors='replace').strip()
                    if decoded:
                        self.line_queue.put(decoded)
            except serial.SerialException:
                break

    def scan_ports(self):
        """扫描可用串口"""
        ports = []
        for p in serial.tools.list_ports.comports():
            ports.append((p.device, p.description))
        return ports


# ======================== 主应用 ========================

class App:
    def __init__(self, root):
        self.root = root
        self.root.title('陶瓷学习器 - 上位机 v1.0')
        self.root.geometry('1100x750')
        self.root.minsize(800, 600)

        # 数据
        self.reader = SerialReader()
        self.data_buf = deque(maxlen=MAX_POINTS)  # [(t, v0, v1, v2, v3, v4), ...]
        self.last_values = [0, 0, 0, 0, 0]
        self.paused = False
        self.sensor_visible = [True] * 5

        self._build_ui()
        self._start_polling()

    # ======================== UI 构建 ========================

    def _build_ui(self):
        # --- 顶部: 串口控制栏 ---
        toolbar = ttk.Frame(self.root)
        toolbar.pack(fill=tk.X, padx=8, pady=4)

        ttk.Label(toolbar, text='串口:').pack(side=tk.LEFT)
        self.port_var = tk.StringVar()
        self.port_combo = ttk.Combobox(toolbar, textvariable=self.port_var, width=20, state='readonly')
        self.port_combo.pack(side=tk.LEFT, padx=4)

        self.connect_btn = ttk.Button(toolbar, text='连接', command=self._toggle_connect)
        self.connect_btn.pack(side=tk.LEFT, padx=2)

        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=8)

        self.pause_btn = ttk.Button(toolbar, text='⏸ 暂停', command=self._toggle_pause)
        self.pause_btn.pack(side=tk.LEFT, padx=2)

        self.clear_btn = ttk.Button(toolbar, text='清空', command=self._clear_data)
        self.clear_btn.pack(side=tk.LEFT, padx=2)

        self.status_label = ttk.Label(toolbar, text='未连接', foreground='gray')
        self.status_label.pack(side=tk.RIGHT, padx=8)

        # --- 中间: 图表 ---
        chart_frame = ttk.Frame(self.root)
        chart_frame.pack(fill=tk.BOTH, expand=True, padx=8, pady=2)

        self.fig = Figure(figsize=(10, 3.5), dpi=100, facecolor='#f8f9fa')
        self.ax = self.fig.add_subplot(111)
        self.ax.set_facecolor('#f8f9fa')
        self.ax.set_ylim(SENSOR_MIN - 100, SENSOR_MAX + 100)
        self.ax.set_xlabel('时间 (秒)')
        self.ax.set_ylabel('传感器值')
        self.ax.grid(True, alpha=0.3)
        self.ax.axhline(SENSOR_MIN, color='gray', ls='--', alpha=0.5, lw=0.8)
        self.ax.axhline(SENSOR_MAX, color='gray', ls='--', alpha=0.5, lw=0.8)

        # 5 条空线
        self.lines = []
        for i in range(5):
            line, = self.ax.plot([], [], color=SENSOR_COLORS[i],
                                 label=SENSOR_NAMES[i], lw=1.5, alpha=0.9)
            self.lines.append(line)

        self.ax.legend(loc='upper right', fontsize=9, ncol=5)
        self.fig.tight_layout()

        self.canvas = FigureCanvasTkAgg(self.fig, master=chart_frame)
        self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        # --- 中间下: 数值显示 ---
        values_frame = ttk.LabelFrame(self.root, text='当前值', padding=4)
        values_frame.pack(fill=tk.X, padx=8, pady=2)

        self.value_labels = []
        for i in range(5):
            color = SENSOR_COLORS[i]
            frame = ttk.Frame(values_frame)
            frame.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=4)

            cb = ttk.Checkbutton(frame, text=SENSOR_NAMES[i],
                                 variable=tk.BooleanVar(value=True),
                                 command=lambda idx=i: self._toggle_sensor(idx))
            cb.pack()

            label = ttk.Label(frame, text='---', font=('Consolas', 18, 'bold'),
                              foreground=color, anchor=tk.CENTER)
            label.pack(fill=tk.X)
            self.value_labels.append(label)

        # --- 底部: 命令控制 ---
        cmd_frame = ttk.LabelFrame(self.root, text='命令控制', padding=4)
        cmd_frame.pack(fill=tk.BOTH, padx=8, pady=(2, 8))

        # 命令输入行
        input_row = ttk.Frame(cmd_frame)
        input_row.pack(fill=tk.X, pady=2)

        ttk.Label(input_row, text='命令:').pack(side=tk.LEFT)
        self.cmd_var = tk.StringVar()
        self.cmd_entry = ttk.Entry(input_row, textvariable=self.cmd_var, width=40)
        self.cmd_entry.pack(side=tk.LEFT, padx=4, fill=tk.X, expand=True)
        self.cmd_entry.bind('<Return>', lambda e: self._send_command())

        send_btn = ttk.Button(input_row, text='发送', command=self._send_command)
        send_btn.pack(side=tk.LEFT, padx=2)

        # 快捷按钮
        btn_row = ttk.Frame(cmd_frame)
        btn_row.pack(fill=tk.X, pady=2)

        quick_cmds = [
            ('HELP', 'HELP'),
            ('LIST', 'LIST'),
            ('模式0', 'MODE 0'),
            ('模式1', 'MODE 1'),
            ('握拳📌', 'CALIB_MIN'),
            ('张开📌', 'CALIB_MAX'),
            ('SAVE', 'SAVE'),
            ('LOAD', 'LOAD'),
        ]

        for label, cmd in quick_cmds:
            btn = ttk.Button(btn_row, text=label, width=8,
                             command=lambda c=cmd: self._quick_cmd(c))
            btn.pack(side=tk.LEFT, padx=1)

        # ==================== 手势管理 ====================
        rec_frame = ttk.LabelFrame(cmd_frame, text='手势管理', padding=4)
        rec_frame.pack(fill=tk.X, pady=2)

        # 容差 (shared)
        tol_row = ttk.Frame(rec_frame)
        tol_row.pack(fill=tk.X, pady=1)
        self.rec_tol_var = tk.StringVar(value='100')
        ttk.Label(tol_row, text='容差:').pack(side=tk.LEFT)
        rec_tol_entry = ttk.Entry(tol_row, textvariable=self.rec_tol_var, width=5)
        rec_tol_entry.pack(side=tk.LEFT, padx=2)

        # 正确手势 (ID 0~4): 匹配时播报"姿势正确"
        ok_row = ttk.Frame(rec_frame)
        ok_row.pack(fill=tk.X, pady=1)
        ttk.Label(ok_row, text='✅ 正确手势:', foreground='#27AE60').pack(side=tk.LEFT)
        for gid in range(5):
            btn = ttk.Button(ok_row, text=str(gid), width=3,
                             command=lambda g=gid: self._quick_record(g))
            btn.pack(side=tk.LEFT, padx=1)

        # 错误手势 (ID 5~9): 匹配时播报"姿势错误"
        err_row = ttk.Frame(rec_frame)
        err_row.pack(fill=tk.X, pady=1)
        ttk.Label(err_row, text='❌ 错误手势:', foreground='#E74C3C').pack(side=tk.LEFT)
        for gid in range(5, 10):
            btn = ttk.Button(err_row, text=str(gid), width=3,
                             command=lambda g=gid: self._quick_record(g))
            btn.pack(side=tk.LEFT, padx=1)

        # 删除行: 独立输入框
        del_row = ttk.Frame(rec_frame)
        del_row.pack(fill=tk.X, pady=1)

        ttk.Label(del_row, text='删除手势 ID:').pack(side=tk.LEFT)
        self.del_id_var = tk.StringVar(value='0')
        del_entry = ttk.Entry(del_row, textvariable=self.del_id_var, width=3)
        del_entry.pack(side=tk.LEFT, padx=2)

        del_btn = ttk.Button(del_row, text='删除', command=self._quick_delete)
        del_btn.pack(side=tk.LEFT, padx=2)

        # 命令响应输出
        ttk.Label(cmd_frame, text='响应:').pack(anchor=tk.W, pady=(4, 0))
        self.response_text = scrolledtext.ScrolledText(
            cmd_frame, height=6, font=('Consolas', 10),
            bg='#1e1e1e', fg='#d4d4d4', wrap=tk.WORD
        )
        self.response_text.pack(fill=tk.BOTH, expand=True, pady=2)
        self.response_text.config(state=tk.DISABLED)

    # ======================== 功能 ========================

    def _toggle_connect(self):
        if self.reader.connected:
            self.reader.disconnect()
            self.connect_btn.config(text='连接')
            self.status_label.config(text='已断开', foreground='gray')
            self._log_response('--- 已断开 ---')
        else:
            port = self.port_var.get().split(' - ')[0] if self.port_var.get() else ''
            if not port:
                self._log_response('请先选择串口')
                return
            result = self.reader.connect(port)
            if result is True:
                self.connect_btn.config(text='断开')
                self.status_label.config(text=f'已连接 {port}', foreground='green')
                self._log_response(f'--- 已连接 {port} ---')
            else:
                self._log_response(f'连接失败: {result}')

    def _toggle_pause(self):
        self.paused = not self.paused
        self.pause_btn.config(text='▶ 继续' if self.paused else '⏸ 暂停')

    def _clear_data(self):
        self.data_buf.clear()
        self._update_chart()

    def _toggle_sensor(self, idx):
        self.sensor_visible[idx] = not self.sensor_visible[idx]
        self.lines[idx].set_visible(self.sensor_visible[idx])
        self.canvas.draw_idle()

    def _send_command(self):
        cmd = self.cmd_var.get().strip()
        if cmd:
            self._log_response(f'> {cmd}')
            if not self.reader.send(cmd):
                self._log_response('发送失败 (未连接)')
            self.cmd_var.set('')

    def _quick_cmd(self, cmd):
        self._log_response(f'> {cmd}')
        if not self.reader.send(cmd):
            self._log_response('发送失败 (未连接)')

    def _quick_record(self, gid):
        tol = self.rec_tol_var.get().strip()
        if not tol:
            tol = '100'
        cmd = f'RECORD {gid} {tol}'
        self._log_response(f'> {cmd}')
        if not self.reader.send(cmd):
            self._log_response('发送失败 (未连接)')

    def _quick_delete(self):
        gid = self.del_id_var.get().strip()
        if not gid:
            self._log_response('请输入要删除的手势ID')
            return
        cmd = f'DELETE {gid}'
        self._log_response(f'> {cmd}')
        if not self.reader.send(cmd):
            self._log_response('发送失败 (未连接)')

    def _log_response(self, text):
        """在响应区添加文本"""
        self.response_text.config(state=tk.NORMAL)
        self.response_text.insert(tk.END, text + '\n')
        self.response_text.see(tk.END)
        self.response_text.config(state=tk.DISABLED)

    def _start_polling(self):
        """刷新串口列表"""
        self._refresh_ports()
        self.root.after(3000, self._refresh_ports)
        # 开始数据轮询
        self.root.after(POLL_MS, self._poll_data)

    def _refresh_ports(self):
        """刷新串口列表 (定时调用)"""
        current = self.port_combo['values']
        ports = self.reader.scan_ports()
        display = [f'{p[0]} - {p[1]}' for p in ports]

        if display != list(current):
            self.port_combo['values'] = display
            if display and not self.port_var.get():
                # 自动选中 Arduino 或第一个串口
                for d in display:
                    if 'arduino' in d.lower() or 'usb' in d.lower():
                        self.port_var.set(d)
                        break
                if not self.port_var.get() and display:
                    self.port_var.set(display[0])

        # 定期刷新
        if not self.reader.connected:
            self.root.after(3000, self._refresh_ports)

    def _poll_data(self):
        """定时轮询串口数据 (由 tkinter after 调用)"""
        if not self.paused:
            updated = False
            while not self.reader.line_queue.empty():
                line = self.reader.line_queue.get_nowait()
                updated = True

                if line.startswith('D,'):
                    # 传感器数据
                    parts = line[2:].split(',')
                    if len(parts) == 5:
                        try:
                            vals = [int(p) for p in parts]
                            t = time.time()
                            self.data_buf.append((t, *vals))
                            self.last_values = vals
                        except ValueError:
                            pass
                else:
                    # 其他文本 → 响应区
                    self._log_response(line)

            if updated and not self.paused:
                self._update_chart()
                self._update_values()

        self.root.after(POLL_MS, self._poll_data)

    def _update_chart(self):
        """更新图表"""
        if not self.data_buf:
            return

        now = time.time()
        data = list(self.data_buf)

        # 取最近 WINDOW_SECS 秒的数据
        cutoff = now - WINDOW_SECS
        recent = [d for d in data if d[0] >= cutoff]

        if len(recent) < 2:
            return

        # 转换为相对时间 (秒前)
        t0 = recent[-1][0] - WINDOW_SECS
        times = [d[0] - t0 for d in recent]

        for i in range(5):
            values = [d[i + 1] for d in recent]
            self.lines[i].set_data(times, values)

        self.ax.set_xlim(0, WINDOW_SECS)
        self.canvas.draw_idle()

    def _update_values(self):
        """更新数值显示"""
        for i in range(5):
            v = self.last_values[i]
            self.value_labels[i].config(text=str(v))

    def on_close(self):
        """窗口关闭清理"""
        self.reader.disconnect()
        self.root.destroy()


# ======================== 入口 ========================

def main():
    root = tk.Tk()
    app = App(root)
    root.protocol('WM_DELETE_WINDOW', app.on_close)
    root.mainloop()


if __name__ == '__main__':
    main()