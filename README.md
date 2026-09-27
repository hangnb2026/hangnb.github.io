# Traffic Monitor

GitHub Pages용 교통안전 CCTV 모니터링 PWA입니다.

## 배포

- 웹앱 Repository: `hangnb.github.io`
- GitHub Pages: `main / root`
- 영상 Release 원본: `hangnb2026/hangnb2026.github.io`
- 영상 Release tag: `videos-v2`

웹앱과 영상 Release는 서로 다른 저장소여도 됩니다. `js/config.js`의
`RELEASE` 설정이 기존 영상 Release 저장소를 가리키므로, `hangnb.github.io`에
배포한 앱도 기존 영상 파일을 사용합니다.

## 데이터

`files/`에는 CCTV별 아래 파일을 둡니다.

```text
*_signal.csv
*_speed.json.gz
*_result.csv
*_violation.csv
```

올림픽공원남단1은 다음 위반 파일을 사용합니다.

```text
올림픽공원남단1_stopline_violations.csv
```

## 위반 Heatmap

각 CCTV 상세 화면은 BEV 배경 위에 위반 발생 위치를 누적 표시합니다.
`x`, `y` (또는 `center_x`, `center_y`) 열이 있는 위반 CSV의 좌표만 실제 위치로
그립니다. 좌표가 없는 기존 range 형식 CSV는 위반 건수는 유지하며, 화면에서 위치
정보가 없음을 안내합니다. 좌표 열을 추가하면 별도 프런트엔드 수정 없이 Heatmap에
자동 반영됩니다.

- 올림픽공원: `files/bg_olympicpark.png`
- 올림픽공원남단: `files/bg_olympicparksouth.png`
- 워커힐: `files/bg_walkerhill.png`

## Speed 변환

```powershell
python tools/convert_speed_csv.py --batch files --output-dir files
```

원본 `*_speed.csv`, `*_break.csv`, `*_coordinates.csv`는 웹 배포에 포함하지 않습니다.
