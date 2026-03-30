package task

// allowedTransitions は設計書で定義したステータス遷移マップ。
// 許可されていない遷移は 422 を返す。
var allowedTransitions = map[TaskStatus]map[TaskStatus]bool{
	StatusUnbid: {StatusBid: true},
	StatusBid:   {StatusRebid: true, StatusWon: true},
	StatusRebid: {StatusBid: true},
	StatusWon:   {},
}

// IsValidTransition は from → to の遷移が許可されているかを返す。
func IsValidTransition(from, to TaskStatus) bool {
	allowed, ok := allowedTransitions[from]
	if !ok {
		return false
	}
	return allowed[to]
}
